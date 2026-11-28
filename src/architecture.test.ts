import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { componentAssets } from './config/assets';
import { sequencePins } from './config/sequencePins';
import { digitalPins } from './config/digitalPins';

const src = dirname(fileURLToPath(import.meta.url));
function activeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'legacy') return [];
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? activeFiles(path)
      : /\.tsx?$/.test(path) && !/\.test\./.test(path)
        ? [path]
        : [];
  });
}

describe('current and retained implementation boundaries', () => {
  it('keeps all imports from active source out of the legacy implementations', () => {
    const violations: string[] = [];
    for (const file of activeFiles(src)) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      const visit = (node: ts.Node) => {
        if (
          ts.isStringLiteral(node) &&
          node.text.startsWith('.') &&
          resolve(dirname(file), node.text).startsWith(join(src, 'legacy') + sep)
        )
          violations.push(`${file}: ${node.text}`);
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(violations).toEqual([]);
    expect(
      readdirSync(join(src, 'store')).filter(
        (name) => /\.ts$/.test(name) && !name.includes('.test.'),
      ),
    ).toEqual(['usePhotoCircuitStore.ts']);
  });

  it('uses the canonical layouts directly without duplicate pin/control/overlay definitions', () => {
    for (const [id, layout] of Object.entries({
      ...sequencePins,
      ...digitalPins,
    })) {
      const asset = componentAssets[id as keyof typeof componentAssets];
      expect(asset.pins).toBe(layout.pins);
      expect(asset.controls).toBe(layout.controls);
      expect(asset.overlays).toBe(layout.overlays);
    }
    const file = join(src, 'config/assets.ts');
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const declaration = source.statements
      .filter(ts.isVariableStatement)
      .flatMap((n) => n.declarationList.declarations)
      .find((n) => ts.isIdentifier(n.name) && n.name.text === 'componentAssets')!;
    expect(ts.isObjectLiteralExpression(declaration.initializer!)).toBe(true);
    const assets = declaration.initializer as ts.ObjectLiteralExpression;
    for (const entry of assets.properties) {
      const object = (entry as ts.PropertyAssignment).initializer as ts.ObjectLiteralExpression;
      expect(
        object.properties
          .filter(ts.isPropertyAssignment)
          .some((p) => ['pins', 'controls', 'overlays'].includes(p.name.getText(source))),
      ).toBe(false);
      expect(
        object.properties
          .filter(ts.isSpreadAssignment)
          .filter((p) => /^(sequencePins|digitalPins)\[/.test(p.expression.getText(source))),
      ).toHaveLength(1);
    }
    expect(source.text).not.toMatch(/Object\.assign\(\s*componentAssets/);
  });
});
