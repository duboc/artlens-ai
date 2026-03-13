import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Annotation Dots Removal', () => {
  const componentsDir = path.resolve(__dirname, '../components');
  const appFile = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf-8');

  it('ImageAnnotationLayer.tsx component file should not exist', () => {
    const filePath = path.join(componentsDir, 'ImageAnnotationLayer.tsx');
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('AnnotationCard.tsx component file should not exist', () => {
    const filePath = path.join(componentsDir, 'AnnotationCard.tsx');
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('App.tsx should not import ImageAnnotationLayer', () => {
    expect(appFile).not.toContain('ImageAnnotationLayer');
  });

  it('App.tsx should not import AnnotationCard', () => {
    expect(appFile).not.toContain('AnnotationCard');
  });

  it('App.tsx should not have activeAnnotation state', () => {
    expect(appFile).not.toContain('activeAnnotation');
  });

  it('App.tsx should not import Annotation type', () => {
    // Should not import Annotation as a standalone type
    expect(appFile).not.toMatch(/\bAnnotation\b/);
  });
});
