import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  formatFiles,
  Tree,
  workspaceRoot,
} from '@nx/devkit';
import { spawn } from 'node:child_process';
import { cp as copy, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { HonoBackendGeneratorSchema } from './schema';

const SupportedHonoServersMap: Record<
  HonoBackendGeneratorSchema['server'],
  string
> = {
  node: 'nodejs',
  deno: 'deno',
  nextjs: 'nextjs',
};

const TMP_LOCATION = 'node_modules/tmp/tmp-hono-backend';
const FilesLocationsMap: Record<string, string> = {
  packageJSON: path.join(workspaceRoot, TMP_LOCATION, 'package.json'),
  tsconfig: path.join(workspaceRoot, TMP_LOCATION, 'tsconfig.json'),
  src: path.join(workspaceRoot, TMP_LOCATION, 'src'),
};
const readTmpPackageJson = async () => {
  return JSON.parse(await readFile(FilesLocationsMap.packageJSON, 'utf-8'));
};
const copyFiles = async (/* tree: Tree, */ projectRoot: string) => {
  await Promise.all([
    copy(FilesLocationsMap.src, path.join(workspaceRoot, projectRoot, 'src'), {
      recursive: true,
    }),
    copy(
      FilesLocationsMap.tsconfig,
      path.join(workspaceRoot, projectRoot, 'tsconfig.json')
    ),
  ]);
};

export async function honoBackendGenerator(
  tree: Tree,
  options: HonoBackendGeneratorSchema
) {
  const { name, server } = options;
  const projectRoot = `apps/${options.name}`;

  console.log(`Generating Hono backend for ${name}`);
  try {
    addProjectConfiguration(tree, options.name, {
      root: projectRoot,
      projectType: 'application',
      sourceRoot: path.join(projectRoot, 'src'),
      targets: {
        build: {
          executor: '@nx/esbuild:esbuild',
          outputs: [`{options.outputPath}`],
          options: {
            outputPath: path.join('dist', projectRoot),
            tsConfig: path.join(projectRoot, 'tsconfig.json'),
            main: path.join(projectRoot, 'src/index.ts'),
          },
        },
        serve: {
          executor: 'nx:run-commands',
          options: {
            command: 'yarn dev',
            cwd: projectRoot,
          },
        },
      },
      name: options.name,
    });

    await new Promise<void>((resolve, reject) => {
      const stream = spawn(
        `node_modules/.bin/yarn`,
        [
          'create',
          'hono',
          `--template ${SupportedHonoServersMap[server]}`,
          '--pm yarn',
        ],
        {
          cwd: workspaceRoot,
        }
      );

      let writing = false;
      stream.once('exit', (code) => {
        if (!code) return;

        if (code > 0) {
          reject(
            new Error(
              `Failed to generate Hono backend process exited with code: ${code}`
            )
          );
          return;
        }

        resolve();
      });

      stream.stdout?.on('data', async (data) => {
        if (!(data instanceof Buffer)) {
          reject('Unexpected data type');
        }
        if (writing) {
          return;
        }

        const str = data.toString();
        const lines = str.split('\n');
        const lastLine = lines[lines.length - 1];

        if (lastLine?.startsWith('? Directory not empty. Continue?')) {
          writing = true;
          await new Promise<void>((res) => {
            stream.stdin.write(`y\r\n`, (err) => {
              if (err) reject(err);

              res();
            });
          });
          writing = false;
        } else if (lastLine?.startsWith('? Target directory (')) {
          writing = true;
          await new Promise<void>((res) => {
            stream.stdin.write(`${TMP_LOCATION}\r\n`, (err) => {
              if (err) reject(err);

              res();
            });
          });
          writing = false;
        } else if (str.startsWith('Done in')) {
          resolve();
        }
      });
    });
  } catch (e) {
    console.error(e);
    throw new Error('Failed to generate Hono backend');
  }
  console.log(`Hono backend for ${name} created`);

  const packageJson = await readTmpPackageJson();

  const installDeps = addDependenciesToPackageJson(
    tree,
    packageJson.dependencies,
    packageJson.devDependencies,
    undefined,
    false
  );

  console.log('Installing deps');
  await installDeps();
  console.log('Copying files');
  await copyFiles(projectRoot);
  console.log('Writing package.json');
  await writeFile(
    path.join(workspaceRoot, projectRoot, 'package.json'),
    JSON.stringify(
      { ...packageJson, dependencies: {}, devDependencies: {} },
      null,
      2
    )
  );

  console.log('Formatting files');
  await formatFiles(tree);
}

export default honoBackendGenerator;
