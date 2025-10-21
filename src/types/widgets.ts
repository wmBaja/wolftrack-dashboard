/**
 * Widget type definitions and registry
 */

export enum WIDGET_TYPES {
  BASE = 'base',
  CHART = 'chart',
}

// Widget position interface
export interface WidgetPosition {
  x: number
  y: number
  w?: number
  h?: number
}

// Widget layout interface
export interface WidgetLayout {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
  static?: boolean
}

// Widget config interface
// Extend as needed for specific widget types
export interface WidgetConfig {
  [key: string]: unknown
}

// Complete widget interface
export interface Widget extends WidgetLayout {
  type: WIDGET_TYPES
  title: string
  config: WidgetConfig
  createdAt: number
}

// Default sizes for each widget type
const WIDGET_DEFAULTS: Record<WIDGET_TYPES, { w: number; h: number; minW: number; minH: number }> = {
  [WIDGET_TYPES.BASE]: { w: 4, h: 4, minW: 2, minH: 2 },
  [WIDGET_TYPES.CHART]: { w: 6, h: 6, minW: 4, minH: 4 },
}

let widgetIdCounter = 0

/**
 * Factory function to create a new widget instance
 */
export function createWidget(type: WIDGET_TYPES, position: WidgetPosition): Widget {
  const defaults = WIDGET_DEFAULTS[type]
  const id = `widget-${widgetIdCounter++}`

  return {
    i: id,
    type,
    title: `${type.charAt(0).toUpperCase() + type.slice(1)} Widget`,
    x: position.x,
    y: position.y,
    w: position.w ?? defaults.w,
    h: position.h ?? defaults.h,
    minW: defaults.minW,
    minH: defaults.minH,
    config: {},
    createdAt: Date.now(),
    static: false,
  }
}
