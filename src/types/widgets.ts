/**
 * Widget type definitions and registry
 */

import type { LayoutItem } from "grid-layout-plus"

export enum WIDGET_TYPES {
  BASE = 'base',
  CHART = 'chart',
}

export interface WidgetConfig {
  [key: string]: unknown
}

export interface Widget extends LayoutItem {
  type: WIDGET_TYPES
  title: string
  config: WidgetConfig
  createdAt: number
}

const WIDGET_DEFAULTS: Record<WIDGET_TYPES, { w: number; h: number; minW: number; minH: number }> = {
  [WIDGET_TYPES.BASE]: { w: 4, h: 4, minW: 2, minH: 2 },
  [WIDGET_TYPES.CHART]: { w: 6, h: 6, minW: 4, minH: 4 },
}

let widgetIdCounter = 0

export function createWidget(type: WIDGET_TYPES, position: {x: number, y: number, w?: number, h?: number}): Widget {
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
