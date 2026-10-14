<?php

declare(strict_types=1);

namespace Devclaim\NeosStyleguide\Fonts;

/**
 * One file of an uploaded font: what an @font-face rule needs. Family, weight and style come from the file name, as
 * fonts are usually delivered: "Inter-SemiBoldItalic.woff2", "SourceSans3-Regular.woff2" (family "Source Sans 3"),
 * a variable font "Inter[wght].woff2" or "Inter-VariableFont_wght.ttf" (all weights).
 */
final readonly class FontFace
{
    private const FORMATS = ['woff2' => 'woff2', 'woff' => 'woff', 'ttf' => 'truetype', 'otf' => 'opentype'];

    /** longest first: "semibold" before "bold" */
    private const WEIGHTS = [
        'extralight' => '200', 'ultralight' => '200', 'extrabold' => '800', 'ultrabold' => '800',
        'semibold' => '600', 'demibold' => '600', 'hairline' => '100', 'regular' => '400', 'medium' => '500',
        'normal' => '400', 'light' => '300', 'black' => '900', 'heavy' => '900', 'thin' => '100', 'bold' => '700',
        'book' => '400', 'roman' => '400',
    ];

    public function __construct(
        public string $family,
        /** "700", or "100 900" for a variable font */
        public string $weight,
        /** "normal" or "italic" */
        public string $style,
        /** the path of the file on this host, e.g. "/_Resources/Persistent/…/Inter-Bold.woff2" */
        public string $path,
        /** woff2, woff, truetype, opentype */
        public string $format,
    ) {
    }

    /** null for a file that is no font (or no family can be read from its name) */
    public static function fromFilename(string $filename, string $path): ?self
    {
        if (!preg_match('/^(.+)\.(woff2|woff|ttf|otf)$/i', $filename, $match)) {
            return null;
        }
        [, $name, $extension] = $match;
        $variable = (bool)preg_match('/\[[^\]]*\]|variable/i', $name);
        $name = preg_replace(['/\[[^\]]*\]/', '/[-_]?variable(font)?([-_].*)?$/i'], '', $name) ?? $name;
        [$familyPart, $descriptor] = array_pad(preg_split('/[-_]/', $name, 2) ?: [$name], 2, '');
        $family = self::familyName((string)$familyPart);
        if ($family === '') {
            return null;
        }
        $descriptor = strtolower((string)$descriptor);

        return new self(
            $family,
            $variable ? '100 900' : self::weightOf($descriptor),
            preg_match('/italic|oblique/', $descriptor) ? 'italic' : 'normal',
            $path,
            self::FORMATS[strtolower($extension)],
        );
    }

    /** "SourceSans3" → "Source Sans 3", "IBMPlexSans" → "IBM Plex Sans"; only letters, digits and spaces */
    private static function familyName(string $part): string
    {
        $spaced = str_contains($part, ' ')
            ? $part
            : preg_replace('/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|(?<=[A-Za-z])(?=\d)/', ' ', $part);

        return trim(preg_replace('/[^A-Za-z0-9 ]/', '', (string)$spaced) ?? '');
    }

    private static function weightOf(string $descriptor): string
    {
        if (preg_match('/\b([1-9]00)\b/', $descriptor, $match)) {
            return $match[1];
        }
        $compact = str_replace(['-', '_', ' '], '', $descriptor);
        foreach (self::WEIGHTS as $keyword => $weight) {
            if (str_contains($compact, $keyword)) {
                return $weight;
            }
        }

        return '400';
    }

    public function css(): string
    {
        return sprintf(
            "@font-face{font-family:'%s';src:url('%s') format('%s');font-weight:%s;font-style:%s;font-display:swap}",
            $this->family,
            addcslashes($this->path, "'\\"),
            $this->format,
            $this->weight,
            $this->style,
        );
    }
}
