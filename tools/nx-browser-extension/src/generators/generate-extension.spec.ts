import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration } from '@nx/devkit';

import { generateExtensionGenerator } from './generate-extension';
import { GenerateExtensionGeneratorSchema } from './schema';

describe('generate-extension generator', () => {
  let tree: Tree;
  const options: GenerateExtensionGeneratorSchema = {
    name: 'test',
    template: 'typescript',
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should run successfully', async () => {
    await generateExtensionGenerator(tree, options);
    const config = readProjectConfiguration(tree, 'test');
    expect(config).toBeDefined();
  });
});
