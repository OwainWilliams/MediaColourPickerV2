import ColorThief from 'colorthief';
import { customElement, html, nothing, property, query, state } from '@umbraco-cms/backoffice/external/lit';
import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { UMB_PROPERTY_DATASET_CONTEXT } from '@umbraco-cms/backoffice/property';
import type { RGBColor } from 'colorthief';
import type { UmbImageCropperPropertyEditorValue } from '@umbraco-cms/backoffice/media';
import type { UmbPropertyEditorUiElement } from '@umbraco-cms/backoffice/property-editor';

type MediaColorFinderValue = {
  average?: string;
  brightest?: string;
  opposite?: string;
  textColour?: string;
};

@customElement('wsc-property-editor-ui-media-color-finder')
export class WscPropertyEditorUIMediaColorFinderElement extends UmbLitElement implements UmbPropertyEditorUiElement {
  #colorThief = new ColorThief();

  @state()
  private _imgSrc?: string;

  @query('#preview')
  private _previewImage?: HTMLImageElement;

  @state()
  private _average?: string;

  @state()
  private _brightest?: string;

  @state()
  private _opposite?: string;

  @state()
  private _textColour?: string;

  @state()
  private _focalPoint?: { left: number; top: number };

  #previousFocalPoint?: { left: number; top: number };

  // internal parsed object and raw JSON string
  #value?: MediaColorFinderValue | undefined;
  #rawValue?: string | undefined;
  #lastRawValue?: string | undefined;

  // The backoffice expects the element's `value` to be the raw persisted value (string).
  // Accept either a raw JSON string (from Umbraco) or an object (internal). Getter returns raw string.
  @property({ attribute: false })
  public set value(value: MediaColorFinderValue | string | undefined) {
    if (typeof value === 'string') {
      this.#rawValue = value;
      try {
        this.#value = JSON.parse(value) as MediaColorFinderValue;
      } catch {
        this.#value = undefined;
      }
    } else if (typeof value === 'object' && value !== null) {
      this.#value = value;
      this.#rawValue = JSON.stringify(value);
    } else {
      this.#value = undefined;
      this.#rawValue = undefined;
    }

    // Populate UI state from parsed object
    if (this.#value) {
      this._average = this.#value.average;
      this._brightest = this.#value.brightest;
      this._opposite = this.#value.opposite;
      this._textColour = this.#value.textColour;
    }
  }
  public get value(): string | undefined {
    // return the raw JSON string (what Umbraco expects to persist)
    return this.#rawValue;
  }

  public set config(config: UmbPropertyEditorUiElement['config']) {
    if (!config) return;
  }

  override connectedCallback() {
    super.connectedCallback();

    this.consumeContext(UMB_PROPERTY_DATASET_CONTEXT, async (propertyDatasetContext) => {
      this.observe(
        await propertyDatasetContext?.propertyValueByAlias<UmbImageCropperPropertyEditorValue>('umbracoFile'),
        (imageCropper) => {
          // Store the previous focal point for comparison
          const newFocalPoint = imageCropper?.focalPoint || { left: 0.5, top: 0.5 };
          const focalPointChanged = !this.#previousFocalPoint ||
            this.#previousFocalPoint.left !== newFocalPoint.left ||
            this.#previousFocalPoint.top !== newFocalPoint.top;

          this._focalPoint = newFocalPoint;
          this.#previousFocalPoint = { ...newFocalPoint };

          if (imageCropper?.temporaryFileId) {
            // If there's a temporary file ID, we'll traverse the DOM to get the temporary image src (blob URL).
            this.#getTemporaryImageSrc();
          } else {
            // Otherwise, the media item exists, and we'll use the image src.
            const srcChanged = this._imgSrc !== imageCropper?.src;
            this._imgSrc = imageCropper?.src;

            // If focal point changed and we have an image, recalculate colors
            if (focalPointChanged && this._imgSrc && this._previewImage && !srcChanged) {
              this.#calculateColors();
            }
          }
        }
      );
    });
  }

  // https://stackoverflow.com/a/50146979/12787
  #convertRgbToHex(rgb: RGBColor): string {
    const toHex = (c: number): string => {
      var hex = c.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return '#' + rgb.map(toHex).join('').toUpperCase();
  }

  // https://stackoverflow.com/a/43508395/12787
  #getBrightest(colors: Array<RGBColor>): RGBColor {
    const luminance = (rgb: RGBColor): number => {
      const gamma = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
      const [r, g, b] = rgb;
      return 0.2126 * gamma(r / 255) + 0.7152 * gamma(g / 255) + 0.0722 * gamma(b / 255);
    };

    let idx = 0;
    let lightest = luminance(colors[0]);

    for (let i = 1; i < colors.length; i++) {
      const current = luminance(colors[i]);
      if (lightest < current) {
        lightest = current;
        idx = i;
      }
    }

    return colors[idx];
  }

  #getTemporaryImageSrc() {
    // HACK: Here be dragons! Insanity-level DOM traversal ahead! Only the brave know how to forgive. [LK]
    // NOTE: This is very fragile and relies on the current structure of Umbraco's DOM. [LK]
    const tempImg = this.getRootNode()
      // @ts-ignore
      ?.host?.getRootNode()
      // @ts-ignore
      ?.host?.getRootNode()
      // @ts-ignore
      ?.host?.getRootNode()
      // @ts-ignore
      ?.host?.shadowRoot?.querySelector('umb-content-workspace-property[alias="umbracoFile"]')
      // @ts-ignore
      ?.shadowRoot?.firstElementChild // @ts-ignore
      ?.shadowRoot?.firstElementChild // @ts-ignore
      ?.shadowRoot?.firstElementChild // @ts-ignore
      ?.querySelector('#editor > umb-property-editor-ui-image-cropper')
      ?.shadowRoot?.firstElementChild // @ts-ignore
      ?.shadowRoot?.querySelector('umb-image-cropper-field')
      // @ts-ignore
      ?.shadowRoot?.querySelector('#main')
      // @ts-ignore
      ?.querySelector('umb-image-cropper-focus-setter')
      // @ts-ignore
      ?.shadowRoot?.querySelector('#image') as HTMLImageElement;

    if (tempImg?.src) {
      this._imgSrc = tempImg.src;

      if (!this._imgSrc) {
        this.#resetValues();
      }
    }
  }

  // https://www.reddit.com/r/webdev/comments/1gwhfg0/comment/lyburza/
  #getTextColor(rgb: RGBColor): string {
    const [r, g, b] = rgb;
    return r * g * b - 1 > 0xffffff / 2 ? '#000000' : '#FFFFFF';
  }

  #invertColor(rgb: RGBColor): RGBColor {
    return rgb.map((c) => 255 - c) as RGBColor;
  }

  // Extract colors from a 10px radius around the focal point
  #extractColorsFromFocalArea(image: HTMLImageElement, focalPoint: { left: number; top: number }): {
    average: RGBColor;
    brightest: RGBColor;
    palette: Array<RGBColor>;
  } {
    // Create a canvas to work with the image data
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    // Set canvas size to match image
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    // Draw the image onto the canvas
    ctx.drawImage(image, 0, 0);

    // Calculate focal point coordinates in pixels
    const focalX = Math.round(focalPoint.left * image.naturalWidth);
    const focalY = Math.round(focalPoint.top * image.naturalHeight);

    // Define the extraction area (10px radius = 20x20 square)
    const radius = 10;
    const startX = Math.max(0, focalX - radius);
    const startY = Math.max(0, focalY - radius);
    const width = Math.min(radius * 2, image.naturalWidth - startX);
    const height = Math.min(radius * 2, image.naturalHeight - startY);

    // Extract image data from the focal area
    const imageData = ctx.getImageData(startX, startY, width, height);
    const data = imageData.data;

    // Collect all pixel colors from the focal area
    const colors: Array<RGBColor> = [];
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = data[i + 3];

      // Only include non-transparent pixels
      if (alpha > 0) {
        colors.push([r, g, b]);
      }
    }

    // Calculate average color from the focal area
    const totalPixels = colors.length;
    if (totalPixels === 0) {
      // Fallback if no valid pixels found
      return {
        average: [128, 128, 128],
        brightest: [255, 255, 255],
        palette: [[128, 128, 128], [255, 255, 255], [0, 0, 0]]
      };
    }

    const avgR = Math.round(colors.reduce((sum, color) => sum + color[0], 0) / totalPixels);
    const avgG = Math.round(colors.reduce((sum, color) => sum + color[1], 0) / totalPixels);
    const avgB = Math.round(colors.reduce((sum, color) => sum + color[2], 0) / totalPixels);

    const average: RGBColor = [avgR, avgG, avgB];

    // Get brightest color from the area
    const brightest = this.#getBrightest(colors);

    // Create a diverse palette by sampling colors and adding some variety
    const palette: Array<RGBColor> = [];

    // Add the average and brightest
    palette.push(average);
    palette.push(brightest);

    // Sample additional colors from the focal area
    for (let i = 0; i < Math.min(colors.length, 10); i += Math.max(1, Math.floor(colors.length / 8))) {
      palette.push(colors[i]);
    }

    // Add some calculated variations
    palette.push(this.#invertColor(average));
    palette.push([Math.min(255, avgR + 40), Math.min(255, avgG + 40), Math.min(255, avgB + 40)]);
    palette.push([Math.max(0, avgR - 40), Math.max(0, avgG - 40), Math.max(0, avgB - 40)]);

    return { average, brightest, palette };
  }

  // Calculate and update colors based on current focal point
  #calculateColors() {
    if (!this._previewImage) return;

    let average: RGBColor;
    let brightest: RGBColor;
    let palette: Array<RGBColor>;

    // Use focal point-based extraction if focal point is available
    if (this._focalPoint) {
      const focalColors = this.#extractColorsFromFocalArea(this._previewImage, this._focalPoint);
      average = focalColors.average;
      brightest = focalColors.brightest;
      palette = focalColors.palette;
    } else {
      // Fallback to original ColorThief method for entire image
      average = this.#colorThief.getColor(this._previewImage);
      palette = this.#colorThief.getPalette(this._previewImage, 20, 10);
      brightest = this.#getBrightest(palette);
    }

    const opposite = this.#invertColor(average);

    this._average = this.#convertRgbToHex(average);
    this._brightest = this.#convertRgbToHex(brightest);
    this._opposite = this.#convertRgbToHex(opposite);
    this._textColour = this.#getTextColor(average);

    // Build object and canonical raw JSON string
    const obj: MediaColorFinderValue = {
      average: this._average,
      brightest: this._brightest,
      opposite: this._opposite,
      textColour: this._textColour,
    };

    const raw = JSON.stringify(obj);

    // Only update/persist if it changed
    if (raw !== this.#lastRawValue) {
      this.#value = obj;
      this.#rawValue = raw;
      this.#lastRawValue = raw;

      // Set element value (raw string) so Umbraco reads it, then notify via UmbChangeEvent (no args).
      // Note: do NOT pass payload to UmbChangeEvent — Umbraco will read the element.value.
      this.value = raw;
      this.dispatchEvent(new UmbChangeEvent());
    }
  }

  #onImgLoad() {
    if (!this._previewImage) return;
    // Calculate colors using the extracted method
    this.#calculateColors();
  }

  #resetValues() {
    this._average = undefined;
    this._brightest = undefined;
    this._opposite = undefined;
    this._textColour = undefined;

    this.#value = undefined;
    this.#rawValue = undefined;
    this.#lastRawValue = undefined;

    // Notify Umbraco the value is cleared
    this.value = undefined;
    this.dispatchEvent(new UmbChangeEvent());
  }

  override render() {
    if (!this._imgSrc) return html`<p><em>Please select an image to extract the colors.</em></p>`;

    const isFocalPointBased = this._focalPoint && (this._focalPoint.left !== 0.5 || this._focalPoint.top !== 0.5);

    return html`
			<img id="preview" hidden src=${this._imgSrc} alt="" @load=${this.#onImgLoad} />
			${isFocalPointBased ? html`
				<p style="font-size: 0.8em; color: #666; margin-bottom: 8px;">
					<uui-icon name="icon-target"></uui-icon>
					Colors extracted from 10px radius around focal point (${Math.round(this._focalPoint!.left * 100)}%, ${Math.round(this._focalPoint!.top * 100)}%)
				</p>
			` : html`
				<p style="font-size: 0.8em; color: #666; margin-bottom: 8px;">
					<uui-icon name="icon-palette"></uui-icon>
					Colors extracted from entire image
				</p>
			`}
			<uui-color-swatches readonly>
				${this.#renderColor('Average', this._average)} ${this.#renderColor('Brightest', this._brightest)}
				${this.#renderColor('Opposite', this._opposite)} ${this.#renderColor('Text color', this._textColour)}
			</uui-color-swatches>
		`;
  }

  #renderColor(label: string, color?: string) {
    if (!color) return nothing;
    return html`<uui-color-swatch show-label label=${label} value=${color}></uui-color-swatch>`;
  }
}

export { WscPropertyEditorUIMediaColorFinderElement as element };

declare global {
  interface HTMLElementTagNameMap {
    'wsc-property-editor-ui-media-color-finder': WscPropertyEditorUIMediaColorFinderElement;
  }
}
