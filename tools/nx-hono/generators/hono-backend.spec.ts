import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration } from '@nx/devkit';

import { honoBackendGenerator } from './hono-backend';
import { HonoBackendGeneratorSchema } from './schema';

describe('hono-backend generator', () => {
  let tree: Tree;
  const options: HonoBackendGeneratorSchema = { name: 'test' };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should run successfully', async () => {
    await honoBackendGenerator(tree, options);
    const config = readProjectConfiguration(tree, 'test');
    expect(config).toBeDefined();
  });
});
