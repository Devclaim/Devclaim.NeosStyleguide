<?php

declare(strict_types=1);

namespace Devclaim\NeosStyleguide\Tokens;

use Neos\Flow\Annotations as Flow;

/**
 * The design tokens of a theme: the CSS custom properties of the theme blocks (Tailwind) of its stylesheets. The CSS is
 * the source, this reads it (name, default value, group, description), so there is no second list to keep in sync. A
 * comment "Group: <label> - <description>" starts a group, "Subgroup: <label>" a part of it, the comment behind a token
 * describes it, other comments are only comments. TokenLayers reads the layers and variants from the same conventions.
 *
 * A site overrides tokens in Neos (the property "designTokens" of its site node, one "--name: value;" per line):
 * rejection() says which overrides are allowed, overrides() turns them into CSS. The same rules as the SvelteKit
 * adapter (tokens.ts), so a value the styleguide takes is taken by the pages.
 */
#[Flow\Proxy(false)]
final readonly class ThemeTokens
{
    /**
     * Tokens Tailwind uses at build time, in media queries: a CSS custom property cannot change them, so a site cannot
     * override them
     */
    public const BUILD_TIME_TOKEN = '/^--(breakpoint|container)-/';

    private const THEME_BLOCK = '/@theme(?:\s+[\w\s]+)?\s*\{(.*?)\n\}/s';
    private const STATEMENT = '#/\*.*?\*/|[^;/]+(?:/(?!\*)[^;/]*)*;(?:[ \t]*/\*.*?\*/)?#s';
    private const COMMENT = '#^/\*(.*?)\*/$#s';
    private const DECLARATION = '#^(--[\w-]+)\s*:\s*(.+?);\s*(?:/\*\s*(.*?)\s*\*/)?$#s';
    /** a site may only reference tokens in var(), and nothing that leaves the declaration or the <style> element */
    private const UNSAFE_VALUE = '#[;{}<>\\\\@]|/\*|url\(|expression\(#i';
    private const MAX_VALUE_LENGTH = 300;

    /**
     * @param list<DesignToken> $defaults
     * @param array<string,true> $known
     */
    private function __construct(
        public array $defaults,
        private array $known,
    ) {
    }

    /**
     * The tokens of the stylesheets (their source), in their order
     */
    public static function fromStylesheets(string ...$stylesheets): self
    {
        $defaults = array_merge(...array_map(self::parse(...), array_values($stylesheets)));
        $known = [];
        foreach ($defaults as $token) {
            $known[$token->name] = true;
        }

        return new self($defaults, $known);
    }

    /**
     * The tokens of the theme blocks of a stylesheet, in their order
     *
     * @return list<DesignToken>
     */
    public static function parse(string $css): array
    {
        $tokens = [];
        preg_match_all(self::THEME_BLOCK, $css, $blocks);
        foreach ($blocks[1] as $block) {
            $group = '';
            $groupDescription = '';
            $subgroup = '';
            // statements: comments and declarations (a declaration may span lines)
            preg_match_all(self::STATEMENT, $block, $statements);
            foreach (array_map(trim(...), $statements[0]) as $statement) {
                if (preg_match(self::COMMENT, $statement, $comment)) {
                    // the lines "Group: <label> - <description>" and "Subgroup: <label>" of the comment (more lines are
                    // only for developers)
                    foreach (explode("\n", $comment[1]) as $line) {
                        $line = trim((string)preg_replace('/^[ \t]*\*?[ \t]*/', '', $line));
                        if (str_starts_with($line, 'Group:')) {
                            preg_match('/^Group:\s*(.+?)(?:\s+-\s+(.*))?$/', $line, $groupComment);
                            $group = trim($groupComment[1] ?? '');
                            $groupDescription = trim($groupComment[2] ?? '');
                            $subgroup = '';
                        } elseif (str_starts_with($line, 'Subgroup:')) {
                            $subgroup = trim(substr($line, strlen('Subgroup:')));
                        }
                    }
                    continue;
                }
                if (preg_match(self::DECLARATION, $statement, $declaration)) {
                    $tokens[] = new DesignToken(
                        name: $declaration[1],
                        value: trim((string)preg_replace('/\s+/', ' ', $declaration[2])),
                        group: $group,
                        groupDescription: $groupDescription,
                        description: $declaration[3] ?? '',
                        subgroup: $subgroup,
                    );
                }
            }
        }

        return $tokens;
    }

    /**
     * Whether a site may change the token (not a build time token)
     */
    public function isEditable(string $name): bool
    {
        return preg_match(self::BUILD_TIME_TOKEN, $name) !== 1;
    }

    /**
     * Why a declaration of a site cannot be taken, or null (also the validation of the styleguide)
     */
    public function rejection(string $name, string $value): ?string
    {
        if (!isset($this->known[$name])) {
            return 'unknown token';
        }
        if (!$this->isEditable($name)) {
            return 'used at build time (media queries), cannot be changed per site';
        }
        if ($value === '' || strlen($value) > self::MAX_VALUE_LENGTH || preg_match(self::UNSAFE_VALUE, $value) === 1) {
            return 'value not allowed';
        }
        preg_match_all('/var\(\s*(--[\w-]+)/', $value, $references);
        foreach ($references[1] as $reference) {
            if (!isset($this->known[$reference])) {
                return 'var() references an unknown token';
            }
        }

        return null;
    }

    /**
     * The overrides of a site (one "--name: value;" per line) as CSS. Only tokens of the theme blocks are taken, no
     * build time tokens (breakpoints), and only values that cannot break out of the declaration; var() may only
     * reference known tokens.
     */
    public function overrides(?string $designTokens): TokenOverrides
    {
        $declarations = [];
        $ignored = [];
        foreach (preg_split('/\r?\n/', $designTokens ?? '') ?: [] as $line) {
            $text = trim((string)preg_replace('/;$/', '', trim($line)));
            if ($text === '') {
                continue;
            }
            if (!preg_match('/^(--[\w-]+)\s*:\s*(.+)$/', $text, $match)) {
                $ignored[] = $text . ' (not "--name: value")';
                continue;
            }
            $value = trim($match[2]);
            $reason = $this->rejection($match[1], $value);
            if ($reason !== null) {
                $ignored[] = $text . ' (' . $reason . ')';
            } else {
                $declarations[] = $match[1] . ':' . $value;
            }
        }

        return new TokenOverrides(implode(';', $declarations), $ignored);
    }
}
