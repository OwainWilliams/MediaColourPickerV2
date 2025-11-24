const editorUi: UmbExtensionManifest = {
  type: 'propertyEditorUi',
  alias: 'WildSiteCreations.PropertyEditorUi.MediaColorFinder',
  name: 'Media Color Finder Property Editor UI',
  element: () => import('./property-editor-ui-media-color-finder.element.js'),
  meta: {
    label: 'Media Color Finder',
    icon: 'icon-science',
    group: 'common',
    propertyEditorSchemaAlias: 'Umbraco.Plain.String'
  },
};

export const manifests = [editorUi];
