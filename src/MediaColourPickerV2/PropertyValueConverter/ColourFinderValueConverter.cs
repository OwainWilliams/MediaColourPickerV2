using System.Text.Json;
using MediaColourPickerV2.Models;
using Microsoft.Extensions.Options;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.PropertyEditors;

namespace MediaColourPickerV2.PropertyValueConverters
{
    public class ColourFinderValueConverter : PropertyValueConverterBase
    {
        private ColourFinderData _colourFinderConfig;

        public ColourFinderValueConverter(IOptionsMonitor<ColourFinderData> colourFinderConfig)
        {
            this._colourFinderConfig = colourFinderConfig.CurrentValue;
            colourFinderConfig.OnChange(config => this._colourFinderConfig = config);
        }

        public override bool IsConverter(IPublishedPropertyType propertyType) => propertyType.EditorUiAlias == "WildSiteCreations.PropertyEditorUi.MediaColorFinder";

        public override Type GetPropertyValueType(IPublishedPropertyType propertyType)
        {
            return typeof(ColourFinderData);
        }

        public override PropertyCacheLevel GetPropertyCacheLevel(IPublishedPropertyType propertyType)
        {
            return PropertyCacheLevel.Element;
        }

        public override object? ConvertIntermediateToObject(IPublishedElement owner,
            IPublishedPropertyType propertyType, PropertyCacheLevel referenceCacheLevel, object? inter, bool preview)
        {
            var interString = inter?.ToString();
            if (string.IsNullOrWhiteSpace(interString))
            {
                return default;
            }

            ColourFinderData? model;
            model = JsonSerializer.Deserialize<ColourFinderData>(interString);

            if (model != null)
            {
                if (string.IsNullOrWhiteSpace(model.Average))
                {
                    model.Average = this._colourFinderConfig.Average;
                }
                if (string.IsNullOrWhiteSpace(model.Brightest))
                {
                    model.Brightest = this._colourFinderConfig.Brightest;
                }
                if (string.IsNullOrWhiteSpace(model.Opposite))
                {
                    model.Opposite = this._colourFinderConfig.Opposite;
                }
                if (string.IsNullOrWhiteSpace(model.TextColour))
                {
                    model.TextColour = this._colourFinderConfig.TextColour;
                }
            }
            return model;
        }
    }
}
