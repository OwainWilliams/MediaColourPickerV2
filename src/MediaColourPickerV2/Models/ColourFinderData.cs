using System.Text.Json.Serialization;

namespace MediaColourPickerV2.Models
{
    public class ColourFinderData
    {
        [JsonPropertyName("average")]
        public string? Average { get; set; }

        [JsonPropertyName("brightest")]
        public string? Brightest { get; set; }

        [JsonPropertyName("opposite")]
        public string? Opposite { get; set; }

        [JsonPropertyName("textColour")]
        public string? TextColour { get; set; }
    }
}
