import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const tokens = (selector) => {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `Missing ${selector}`);
  const block = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()]));
};
const light = tokens(':root');
const dark = tokens(':root[data-theme="dark"]');

function luminance(hex) {
  assert.match(hex, /^#[0-9a-f]{6}$/i);
  const [r, g, b] = hex.slice(1).match(/../g).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

for (const [name, palette] of Object.entries({ light, dark })) {
  test(`${name}: primary buttons and hover labels meet WCAG AA`, () => {
    for (const background of ['--primary-accent', '--primary-accent-hover']) {
      const ratio = contrast(palette['--text-inverse'], palette[background]);
      assert.ok(ratio >= 4.5, `${background}: ${ratio.toFixed(2)}:1`);
    }
  });

  test(`${name}: text remains readable across page, card, input and elevated surfaces`, () => {
    for (const foreground of ['--text-main', '--text-muted', '--text-light', '--primary']) {
      for (const background of ['--bg-main', '--bg-card', '--bg-inset', '--bg-elevated', '--primary-light']) {
        const ratio = contrast(palette[foreground], palette[background]);
        assert.ok(ratio >= 4.5, `${foreground} on ${background}: ${ratio.toFixed(2)}:1`);
      }
    }
  });
}

test('dark theme defines every color and shadow token rather than inheriting light colors', () => {
  const shared = ['--font-sans', '--font-heading', '--sidebar-width', '--transition-smooth'];
  assert.deepEqual(Object.keys(dark).sort(), Object.keys(light).filter((key) => !shared.includes(key)).sort());
});

test('landing previews and workflow use shared theme surfaces', () => {
  const features = readFileSync(new URL('../src/components/landing/css/LandingFeatures.css', import.meta.url), 'utf8');
  const workflow = readFileSync(new URL('../src/components/landing/css/LandingInsights.css', import.meta.url), 'utf8');
  for (const source of [features, workflow]) {
    assert.doesNotMatch(source, /--(?:scene|momentum)-[\w-]+:\s*(?:#|rgba?\()/);
  }
  assert.match(features, /--scene-bg:\s*var\(--bg-main\)/);
  assert.match(workflow, /--momentum-bg:\s*var\(--bg-main\)/);
});
