<?php

declare(strict_types=1);

namespace Devclaim\NeosStyleguide\Tokens;

use Neos\Flow\Annotations as Flow;

/**
 * The layers of the tokens (PROTOCOL.md, "Layers and variants"), read from the conventions of the stylesheets, so there
 * is no second list to keep in sync. The same rules as the SvelteKit adapter (layers.ts):
 * - a group whose label starts with "Semantic" holds semantic tokens (what components use), every other group design
 *   tokens (the raw values of the design)
 * - a semantic token named like another one plus "-light", "-dark" (the color scheme) or "-base", "-md", "-lg", "-xl"
 *   (from that width) is a variant of it
 * - a semantic token points at the design groups its family uses: the groups of the design tokens that the tokens of
 *   its group (with the variant groups: "Semantic colors", "Semantic colors (light)", "… (dark)") refer to, of its
 *   namespace; without any reference, every design group of its namespace
 *
 * A theme without semantic tokens has no layers: then the interface shows the tokens by group.
 */
#[Flow\Proxy(false)]
final class TokenLayers
{
    /** the variants, in their order: the color scheme, then the widths */
    public const VARIANTS = ['light', 'dark', 'base', 'md', 'lg', 'xl'];

    /** the namespaces of the tokens (Tailwind's), longest first: a token points at tokens of its own namespace */
    private const NAMESPACES = [
        'leading-line-height',
        'paragraph-spacing',
        'text-size',
        'max-width',
        'spacing',
        'color',
        'radius',
        'shadow',
        'font',
        'aspect',
    ];

    /**
     * The layer, variants and design token groups of every token, by name; empty without semantic tokens
     *
     * @param list<DesignToken> $defaults
     * @param \Closure(string):string $groupId the id of a group in the protocol, by its label
     * @return array<string,array{layer:string,variants?:list<array{id:string,token:string}>,variantOf?:string,variant?:string,pointsAt?:list<string>}>
     */
    public static function of(array $defaults, \Closure $groupId): array
    {
        $semantic = [];
        foreach ($defaults as $token) {
            if (self::isSemanticGroup($token->group)) {
                $semantic[$token->name] = true;
            }
        }
        if ($semantic === []) {
            return [];
        }
        $byName = [];
        foreach ($defaults as $token) {
            $byName[$token->name] = $token;
        }

        // the design groups per namespace, in their order
        $designGroups = [];
        foreach ($defaults as $token) {
            $namespace = self::namespaceOf($token->name);
            if (isset($semantic[$token->name]) || $namespace === null) {
                continue;
            }
            $id = $groupId($token->group);
            if (!in_array($id, $designGroups[$namespace] ?? [], true)) {
                $designGroups[$namespace][] = $id;
            }
        }

        // the design groups each family refers to, per namespace
        $referred = [];
        foreach ($defaults as $token) {
            if (!isset($semantic[$token->name])) {
                continue;
            }
            preg_match_all('/var\(\s*(--[\w-]+)/', $token->value, $references);
            foreach ($references[1] as $name) {
                $target = $byName[$name] ?? null;
                $namespace = self::namespaceOf($name);
                if ($target !== null && !isset($semantic[$name]) && $namespace === self::namespaceOf($token->name)) {
                    $referred[self::familyOf($token->group) . ' ' . $namespace][$groupId($target->group)] = true;
                }
            }
        }

        // the variants of a semantic token, and which token a variant is a value of
        $variantName = '/^(--[\w-]+)-(' . implode('|', self::VARIANTS) . ')$/';
        $variants = [];
        $variantOf = [];
        foreach ($defaults as $token) {
            if (
                isset($semantic[$token->name])
                && preg_match($variantName, $token->name, $match) === 1
                && isset($semantic[$match[1]])
            ) {
                $variants[$match[1]][] = ['id' => $match[2], 'token' => $token->name];
                $variantOf[$token->name] = ['variantOf' => $match[1], 'variant' => $match[2]];
            }
        }
        $order = fn (array $a, array $b) => array_search($a['id'], self::VARIANTS, true)
            <=> array_search($b['id'], self::VARIANTS, true);

        $layers = [];
        foreach ($defaults as $token) {
            if (!isset($semantic[$token->name])) {
                $layers[$token->name] = ['layer' => 'design'];
                continue;
            }
            $namespace = self::namespaceOf($token->name);
            $all = $namespace !== null ? ($designGroups[$namespace] ?? []) : [];
            $used = $referred[self::familyOf($token->group) . ' ' . $namespace] ?? null;
            $pointsAt = $used !== null
                ? array_values(array_filter($all, fn (string $group) => isset($used[$group])))
                : $all;
            $own = $variants[$token->name] ?? [];
            usort($own, $order);
            $layers[$token->name] = [
                'layer' => 'semantic',
                ...($pointsAt !== [] ? ['pointsAt' => $pointsAt] : []),
                ...($own !== [] ? ['variants' => $own] : []),
                ...($variantOf[$token->name] ?? []),
            ];
        }

        return $layers;
    }

    public static function isSemanticGroup(string $group): bool
    {
        return preg_match('/^semantic\b/i', trim($group)) === 1;
    }

    public static function namespaceOf(string $name): ?string
    {
        foreach (self::NAMESPACES as $namespace) {
            if (str_starts_with($name, '--' . $namespace . '-')) {
                return $namespace;
            }
        }

        return null;
    }

    /** the family of a group: its label without the variant ("Semantic colors (light)" → "semantic colors") */
    private static function familyOf(string $group): string
    {
        return strtolower(trim((string)preg_replace('/\s*\([^)]*\)\s*$/', '', $group)));
    }
}
