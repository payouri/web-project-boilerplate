export type AvailableTemplates =
  | 'typescript'
  | 'react'
  | 'vue'
  | 'react-content-script';

export interface GenerateExtensionGeneratorSchema {
  name: string;
  template: AvailableTemplates;
}
