const DARK_FOREGROUND = "#18231a";
const LIGHT_FOREGROUND = "#ffffff";
const BLACK_FOREGROUND = "#000000";
const MINIMUM_TEXT_CONTRAST = 4.5;

function relativeLuminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g)!.map((channel) => parseInt(channel, 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return linear.reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrastRatio(first: number, second: number): number {
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getStoreOnPrimary(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return LIGHT_FOREGROUND;
  const background = relativeLuminance(hex);
  if (contrastRatio(background, relativeLuminance(DARK_FOREGROUND)) >= MINIMUM_TEXT_CONTRAST)
    return DARK_FOREGROUND;
  if (contrastRatio(background, relativeLuminance(LIGHT_FOREGROUND)) >= MINIMUM_TEXT_CONTRAST)
    return LIGHT_FOREGROUND;
  return BLACK_FOREGROUND;
}
