import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  formatFiles,
  getProjects,
  Tree,
  updateProjectConfiguration,
  workspaceRoot,
} from '@nx/devkit';
import { exec, spawn } from 'node:child_process';
import {
  access,
  cp as copy,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import * as path from 'path';
import { AvailableTemplates, GenerateExtensionGeneratorSchema } from './schema';

const TMP_LOCATION = 'node_modules/tmp/generate-extension';
const FILES_TO_COPY: Readonly<Record<AvailableTemplates, string[]>> = {
  react: [
    'newtab',
    'template.spec.ts',
    'public',
    'manifest.json',
    'images',
    'extension-env.d.ts',
    'README.md',
  ],
  typescript: ['manifest.json', 'template.spec.ts'],
  vue: ['manifest.json', 'template.spec.ts'],
  'react-content-script': [
    'README.md',
    'background.ts',
    'content',
    'extension-env.d.ts',
    'manifest.json',
    'images',
    'postcss.config.js',
    'public',
    'tailwind.config.js',
    'template.spec.ts',
  ],
};

const copyFiles = async (
  extensionType: AvailableTemplates,
  extensionName: string
) => {
  await Promise.all(
    FILES_TO_COPY[extensionType].map(async (file) => {
      await copy(
        path.join(TMP_LOCATION, extensionName, file),
        path.join(workspaceRoot, 'apps', extensionName, file),
        {
          recursive: true,
        }
      );
    })
  );
};
const getFilesLocationsMap = (
  extensionName: string
): Record<string, string> => ({
  packageJSON: path.join(
    workspaceRoot,
    TMP_LOCATION,
    extensionName,
    'package.json'
  ),
  tsconfig: path.join(
    workspaceRoot,
    TMP_LOCATION,
    extensionName,
    'tsconfig.json'
  ),
  src: path.join(workspaceRoot, TMP_LOCATION, extensionName, 'src'),
});
const SupportedExtensionTemplateMap = {
  typescript: 'new-typescript',
  react: 'new-react',
  vue: 'new-vue',
  'react-content-script': 'content-react',
} as const;
const readTmpPackageJson = async (extensionName: string) =>
  JSON.parse(
    await readFile(getFilesLocationsMap(extensionName).packageJSON, 'utf-8')
  );
const readTmpTsConfigJson = async (extensionName: string) =>
  JSON.parse(
    await readFile(getFilesLocationsMap(extensionName).tsconfig, 'utf-8')
  );

const cleanup = async () => {
  if (isExistingFile(TMP_LOCATION)) {
    await rm(TMP_LOCATION, { recursive: true });
  }
};

const isExistingFile = async (filePath: string) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const createDirIfNotExists = async (dir: string) => {
  const exists = await isExistingFile(dir);

  if (exists) {
    return;
  }

  await mkdir(dir, {
    recursive: true,
  });
};

export async function generateExtensionGenerator(
  tree: Tree,
  options: GenerateExtensionGeneratorSchema
) {
  const { template } = options;
  const projectRoot = `apps/${options.name}`;
  const projects = getProjects(tree);
  const projectData = projects.get(options.name);

  const isExistingProject = Boolean(projectData);

  await createDirIfNotExists(path.join(workspaceRoot, 'apps'));

  try {
    await new Promise<void>((resolve, reject) => {
      const stream = spawn(
        `node_modules/.bin/yarn`,
        [
          'extension',
          'create',
          path.join(TMP_LOCATION, options.name),
          '--template',
          SupportedExtensionTemplateMap[template],
        ],
        {
          cwd: workspaceRoot,
        }
      );

      stream.stdout?.on('data', (data) => {
        console.log(data.toString());
      });
      stream.stderr?.on('data', (data) => {
        const d = data.toString().trim();
        if (!d) return;

        console.error('err', d);
      });
      stream.once('exit', (code) => {
        if (code == null) return;

        if (code > 0) {
          reject(
            new Error(
              `Failed to generate extension, process exited with status code: ${code}`
            )
          );
          return;
        }

        resolve();
      });
    });

    console.log(
      await readdir(path.join(TMP_LOCATION, options.name), {
        withFileTypes: true,
      })
    );

    const [pkgJSON, tsConfig] = await Promise.all([
      readTmpPackageJson(options.name),
      readTmpTsConfigJson(options.name),
    ]);

    (isExistingProject ? updateProjectConfiguration : addProjectConfiguration)(
      tree,
      options.name,
      {
        root: projectRoot,
        projectType: 'application',
        sourceRoot: path.join(projectRoot, 'src'),
        targets: {
          dev: {
            executor: 'nx:run-commands',
            options: {
              command: pkgJSON.scripts.dev,
              cwd: projectRoot,
            },
          },
          start: {
            executor: 'nx:run-commands',
            options: {
              command: pkgJSON.scripts.start,
              cwd: projectRoot,
            },
          },
          build: {
            executor: 'nx:run-commands',
            options: {
              command: pkgJSON.scripts.build,
              cwd: projectRoot,
            },
          },
        },
      }
    );
    const installDeps = addDependenciesToPackageJson(
      tree,
      pkgJSON.dependencies,
      pkgJSON.devDependencies,
      undefined,
      false
    );
    await installDeps?.();
    await copyFiles(options.template, options.name);
    await Promise.all([
      writeFile(
        path.join(workspaceRoot, 'apps', options.name, 'tsconfig.json'),
        JSON.stringify(
          {
            extends: '../../tsconfig.base.json',
            compilerOptions: {
              ...tsConfig.compilerOptions,
              outDir: `../../dist/apps/${options.name}`,
            },
          },
          null,
          2
        )
      ),
      writeFile(
        path.join(workspaceRoot, 'apps', options.name, 'package.json'),
        JSON.stringify(
          {
            ...pkgJSON,
            scripts: {},
          },
          null,
          2
        )
      ),
    ]);
    await formatFiles(tree);

    // TODO: Find a way to stop install deps for app project as otherwise the dev script breaks
    await new Promise<void>((resolve, reject) => {
      exec(
        `ln -s ${workspaceRoot}/node_modules ${path.join(
          workspaceRoot,
          projectRoot,
          'node_modules'
        )}`,
        {},
        (err) => {
          if (err) reject(err);

          resolve();
        }
      );
    });
  } catch (e) {
    console.error(e);
    throw new Error('Failed to generate extension');
  } finally {
    await cleanup();
  }
}

export default generateExtensionGenerator;
