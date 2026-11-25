import React, { useMemo } from 'react';
import {
  PptxAnimationEffect,
  PptxChartElement,
  PptxDirection,
  PptxElement,
  PptxFill,
  PptxImageElement,
  PptxParagraph,
  PptxShapeElement,
  PptxSlide,
  PptxStroke,
  PptxTableElement,
} from '../types/pptx';

interface PptxSlideStageProps {
  slide: PptxSlide;
  width: number;
  height: number;
  stepIndex: number; // 0 = initial state (autoEffects played), 1..clickSteps.length
  justTriggeredStep: number | null; // index (0 for auto, 1..N for click step) currently animating
  animNonce: number; // incremented on step trigger so CSS keyframes replay cleanly
}

export function fillToCss(fill: PptxFill): React.CSSProperties {
  if (fill.type === 'none') return { background: 'transparent' };
  if (fill.type === 'solid') return { background: fill.color };
  if (fill.type === 'gradient') {
    const stops = fill.stops.map((s) => `${s.color} ${s.pos}%`).join(', ');
    if (fill.kind === 'radial') {
      return { background: `radial-gradient(circle, ${stops})` };
    }
    return { background: `linear-gradient(${fill.angleDeg}deg, ${stops})` };
  }
  if (fill.type === 'image') {
    return {
      backgroundImage: `url("${fill.src}")`,
      backgroundSize: fill.mode === 'tile' ? 'auto' : '100% 100%',
      backgroundRepeat: fill.mode === 'tile' ? 'repeat' : 'no-repeat',
      backgroundPosition: 'center',
    };
  }
  return {};
}

function strokeDashArray(dash?: PptxStroke['dash'], width = 2): string | undefined {
  if (!dash || dash === 'solid') return undefined;
  if (dash === 'dot') return `${Math.max(1, width * 0.5)} ${Math.max(4, width * 2.5)}`;
  if (dash === 'dashDot') return `${width * 4} ${width * 2} ${width} ${width * 2}`;
  return `${width * 4} ${width * 2.5}`;
}

function getPresetPolygonPoints(preset: string, w: number, h: number, adj?: number[]): string | null {
  const a0 = adj?.[0];
  switch (preset) {
    case 'triangle':
      return `${w * (a0 ?? 0.5)},0 ${w},${h} 0,${h}`;
    case 'rtTriangle':
      return `0,0 ${w},${h} 0,${h}`;
    case 'diamond':
      return `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;
    case 'parallelogram': {
      const skew = w * (a0 ?? 0.22);
      return `${skew},0 ${w},0 ${w - skew},${h} 0,${h}`;
    }
    case 'trapezoid': {
      const dx = w * (a0 ?? 0.2);
      return `${dx},0 ${w - dx},0 ${w},${h} 0,${h}`;
    }
    case 'pentagon':
      return `${w * 0.5},0 ${w},${h * 0.38} ${w * 0.81},${h} ${w * 0.19},${h} 0,${h * 0.38}`;
    case 'hexagon': {
      const dx = w * (a0 ?? 0.25);
      return `${dx},0 ${w - dx},0 ${w},${h / 2} ${w - dx},${h} ${dx},${h} 0,${h / 2}`;
    }
    case 'chevron': {
      const tip = Math.min(w * 0.45, w * (a0 ?? 0.25));
      return `0,0 ${w - tip},0 ${w},${h / 2} ${w - tip},${h} 0,${h} ${tip},${h / 2}`;
    }
    case 'homePlate': {
      const tip = Math.min(w * 0.45, w * (a0 ?? 0.25));
      return `0,0 ${w - tip},0 ${w},${h / 2} ${w - tip},${h} 0,${h}`;
    }
    case 'rightArrow': {
      const headW = Math.min(w * 0.45, h * 0.55);
      const shaftTop = h * 0.25;
      const shaftBot = h * 0.75;
      return `0,${shaftTop} ${w - headW},${shaftTop} ${w - headW},0 ${w},${h / 2} ${w - headW},${h} ${w - headW},${shaftBot} 0,${shaftBot}`;
    }
    case 'leftArrow': {
      const headW = Math.min(w * 0.45, h * 0.55);
      const shaftTop = h * 0.25;
      const shaftBot = h * 0.75;
      return `${w},${shaftTop} ${headW},${shaftTop} ${headW},0 0,${h / 2} ${headW},${h} ${headW},${shaftBot} ${w},${shaftBot}`;
    }
    case 'upArrow': {
      const headH = Math.min(h * 0.45, w * 0.55);
      return `${w / 2},0 ${w},${headH} ${w * 0.75},${headH} ${w * 0.75},${h} ${w * 0.25},${h} ${w * 0.25},${headH} 0,${headH}`;
    }
    case 'downArrow': {
      const headH = Math.min(h * 0.45, w * 0.55);
      return `${w * 0.25},0 ${w * 0.75},0 ${w * 0.75},${h - headH} ${w},${h - headH} ${w / 2},${h} 0,${h - headH} ${w * 0.25},${h - headH}`;
    }
    case 'leftRightArrow': {
      const headW = Math.min(w * 0.3, h * 0.5);
      return `0,${h / 2} ${headW},0 ${headW},${h * 0.28} ${w - headW},${h * 0.28} ${w - headW},0 ${w},${h / 2} ${w - headW},${h} ${w - headW},${h * 0.72} ${headW},${h * 0.72} ${headW},${h}`;
    }
    case 'star4':
    case 'star5':
    case 'star6':
    case 'star8': {
      const spikes = preset === 'star4' ? 4 : preset === 'star6' ? 6 : preset === 'star8' ? 8 : 5;
      const pts: string[] = [];
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? 0.5 : 0.22;
        const ang = (i * Math.PI) / spikes - Math.PI / 2;
        pts.push(`${(0.5 + Math.cos(ang) * r) * w},${(0.5 + Math.sin(ang) * r) * h}`);
      }
      return pts.join(' ');
    }
    default:
      return null;
  }
}

function getKeyframeAnimationStyle(
  effect: PptxAnimationEffect | null
): React.CSSProperties {
  if (!effect) return {};
  const dur = `${effect.durationMs}ms`;
  const delay = `${effect.delayMs}ms`;
  const dir: PptxDirection = effect.direction || 'd';

  if (effect.animClass === 'exit') {
    let kf = 'pptxFadeOut';
    if (effect.effectName === 'fly' || effect.effectName === 'float') {
      kf =
        dir === 'l'
          ? 'pptxSlideOutLeft'
          : dir === 'r'
            ? 'pptxSlideOutRight'
            : dir === 'u'
              ? 'pptxSlideOutUp'
              : 'pptxSlideOutDown';
    } else if (effect.effectName === 'zoom') {
      kf = 'pptxZoomOut';
    }
    return {
      animation: `${kf} ${dur} cubic-bezier(0.22, 1, 0.36, 1) ${delay} both`,
    };
  }

  if (effect.animClass === 'emph') {
    if (effect.effectName === 'teeter') {
      return { animation: `pptxTeeter ${dur} ease-in-out ${delay} 1` };
    }
    return { animation: `pptxPulse ${dur} ease-in-out ${delay} 1` };
  }

  // Entrance animations
  let kf = 'pptxFadeIn';
  let timing = 'cubic-bezier(0.16, 1, 0.3, 1)';
  switch (effect.effectName) {
    case 'appear':
      kf = 'pptxFadeIn';
      break;
    case 'fly':
      kf =
        dir === 'l'
          ? 'pptxSlideInLeft'
          : dir === 'r'
            ? 'pptxSlideInRight'
            : dir === 'u'
              ? 'pptxSlideInDown'
              : 'pptxSlideInUp';
      break;
    case 'float':
      kf = dir === 'u' ? 'pptxFloatDown' : 'pptxFloatUp';
      break;
    case 'wipe':
      kf =
        dir === 'l'
          ? 'pptxWipeLeft'
          : dir === 'u'
            ? 'pptxWipeUp'
            : dir === 'd'
              ? 'pptxWipeDown'
              : 'pptxWipeRight';
      timing = 'linear';
      break;
    case 'split':
      kf = dir === 'vert' ? 'pptxSplitVertOut' : 'pptxSplitHorzOut';
      break;
    case 'circle':
    case 'wheel':
      kf = 'pptxCircleIn';
      break;
    case 'diamond':
    case 'box':
      kf = 'pptxDiamondIn';
      break;
    case 'zoom':
      kf = 'pptxZoomIn';
      break;
    case 'bounce':
      kf = 'pptxBounceIn';
      timing = 'ease-out';
      break;
    case 'swivel':
      kf = 'pptxSwivelIn';
      break;
    case 'blinds':
      kf = 'pptxWipeDown';
      break;
    default:
      kf = 'pptxFadeIn';
  }

  return {
    animation: `${kf} ${dur} ${timing} ${delay} both`,
  };
}

interface ElementAnimStatus {
  visible: boolean;
  activeEffect: PptxAnimationEffect | null;
  paragraphStates: Map<number, { visible: boolean; activeEffect: PptxAnimationEffect | null }>;
}

function evaluateAnimations(
  slide: PptxSlide,
  stepIndex: number,
  justTriggeredStep: number | null
): Map<string, ElementAnimStatus> {
  const map = new Map<string, ElementAnimStatus>();

  const getOrCreate = (shapeId: string): ElementAnimStatus => {
    let entry = map.get(shapeId);
    if (!entry) {
      entry = { visible: true, activeEffect: null, paragraphStates: new Map() };
      map.set(shapeId, entry);
    }
    return entry;
  };

  // Pass 1: discover which shapes / paragraphs start hidden because their FIRST animation is an entrance
  const firstWholeClass = new Map<string, PptxAnimationEffect['animClass']>();
  const firstParaClass = new Map<string, PptxAnimationEffect['animClass']>();

  const registerEffectShape = (eff: PptxAnimationEffect) => {
    if (eff.paragraphStart !== undefined) {
      const end = eff.paragraphEnd ?? eff.paragraphStart;
      for (let p = eff.paragraphStart; p <= end; p++) {
        const key = `${eff.targetShapeId}:${p}`;
        if (!firstParaClass.has(key)) firstParaClass.set(key, eff.animClass);
      }
    } else {
      if (!firstWholeClass.has(eff.targetShapeId)) {
        firstWholeClass.set(eff.targetShapeId, eff.animClass);
      }
    }
  };

  slide.autoEffects.forEach(registerEffectShape);
  slide.clickSteps.forEach((step) => step.effects.forEach(registerEffectShape));

  firstWholeClass.forEach((cls, shapeId) => {
    const st = getOrCreate(shapeId);
    if (cls === 'entr') st.visible = false;
  });

  firstParaClass.forEach((cls, key) => {
    const [shapeId, pStr] = key.split(':');
    const st = getOrCreate(shapeId);
    st.paragraphStates.set(Number(pStr), {
      visible: cls !== 'entr',
      activeEffect: null,
    });
  });

  // Pass 2: replay effects up to current stepIndex
  const applyEffect = (eff: PptxAnimationEffect, isJustTriggered: boolean) => {
    const st = getOrCreate(eff.targetShapeId);
    if (eff.paragraphStart !== undefined) {
      const end = eff.paragraphEnd ?? eff.paragraphStart;
      for (let p = eff.paragraphStart; p <= end; p++) {
        const pState = st.paragraphStates.get(p) || { visible: true, activeEffect: null };
        if (eff.animClass === 'entr') pState.visible = true;
        else if (eff.animClass === 'exit') pState.visible = isJustTriggered ? true : false;
        if (isJustTriggered) pState.activeEffect = eff;
        st.paragraphStates.set(p, pState);
      }
      // Also keep container visible when paragraphs animate
      st.visible = true;
    } else {
      if (eff.animClass === 'entr') {
        st.visible = true;
      } else if (eff.animClass === 'exit') {
        // Keep visible ONLY while exit animation plays, otherwise hide
        st.visible = isJustTriggered;
      }
      if (isJustTriggered) {
        st.activeEffect = eff;
      }
    }
  };

  slide.autoEffects.forEach((eff) => applyEffect(eff, justTriggeredStep === 0));
  for (let i = 0; i < Math.min(stepIndex, slide.clickSteps.length); i++) {
    const isNow = justTriggeredStep === i + 1;
    slide.clickSteps[i].effects.forEach((eff) => applyEffect(eff, isNow));
  }

  return map;
}

const ParagraphView: React.FC<{
  p: PptxParagraph;
  animStyle?: React.CSSProperties;
  visible: boolean;
  animKey?: string;
}> = ({ p, animStyle, visible, animKey }) => {
  const justify =
    p.align === 'center'
      ? 'center'
      : p.align === 'right'
        ? 'flex-end'
        : p.align === 'justify'
          ? 'space-between'
          : 'flex-start';

  const hasText = p.runs.some((r) => r.text.length > 0);

  return (
    <div
      key={animKey}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: justify,
        textAlign: p.align,
        paddingLeft: Math.max(0, p.marginLeftPx || 0),
        textIndent: p.indentPx || 0,
        marginTop: p.spaceBeforePx || 0,
        marginBottom: p.spaceAfterPx ?? 4,
        lineHeight: p.lineHeight || 1.2,
        opacity: visible ? 1 : 0,
        visibility: visible ? 'visible' : 'hidden',
        minHeight: hasText ? undefined : (p.runs[0]?.fontSizePx || 16) * 0.9,
        ...animStyle,
      }}
    >
      {p.bulletChar && hasText && (
        <span
          style={{
            marginRight: 10,
            color: p.bulletColor || p.runs[0]?.color || 'inherit',
            fontSize: p.runs[0]?.fontSizePx || 18,
            flexShrink: 0,
          }}
        >
          {p.bulletChar}
        </span>
      )}
      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {p.runs.map((r, rIdx) => (
          <span
            key={rIdx}
            style={{
              fontFamily: r.fontFamily || '"DM Sans", sans-serif',
              fontSize: r.baseline ? r.fontSizePx * 0.68 : r.fontSizePx,
              color: r.color,
              fontWeight: r.bold ? 700 : 400,
              fontStyle: r.italic ? 'italic' : 'normal',
              textDecoration: [
                r.underline ? 'underline' : '',
                r.strike ? 'line-through' : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined,
              verticalAlign: r.baseline
                ? r.baseline > 0
                  ? 'super'
                  : 'sub'
                : undefined,
            }}
          >
            {r.text}
          </span>
        ))}
      </span>
    </div>
  );
};

const ChartSvgView: React.FC<{ el: PptxChartElement }> = ({ el }) => {
  const w = Math.max(120, el.width);
  const h = Math.max(90, el.height);
  const padL = 56;
  const padR = 20;
  const padT = el.title ? 46 : 20;
  const padB = el.showLegend ? 66 : 40;
  const plotW = Math.max(40, w - padL - padR);
  const plotH = Math.max(40, h - padT - padB);

  const allVals = el.series.flatMap((s) => s.values);
  const maxVal = Math.max(1, ...allVals, 0);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <rect x={0} y={0} width={w} height={h} fill="rgba(255,255,255,0.9)" rx={8} />
      {el.title && (
        <text
          x={w / 2}
          y={26}
          textAnchor="middle"
          fontSize={18}
          fontWeight={700}
          fill="#0F172A"
        >
          {el.title}
        </text>
      )}

      {(el.chartType === 'pie' || el.chartType === 'doughnut') && el.series[0] ? (
        (() => {
          const vals = el.series[0].values;
          const total = vals.reduce((a, b) => a + Math.max(0, b), 0) || 1;
          const cx = w / 2;
          const cy = padT + plotH / 2;
          const rad = Math.min(plotW, plotH) * 0.44;
          const innerRad = el.chartType === 'doughnut' ? rad * 0.52 : 0;
          let angle = -Math.PI / 2;
          const palette = ['#2563EB', '#EA580C', '#16A34A', '#9333EA', '#0891B2', '#E11D48', '#CA8A04'];
          return vals.map((v, i) => {
            const slice = (Math.max(0, v) / total) * Math.PI * 2;
            const a1 = angle;
            const a2 = angle + slice;
            angle = a2;
            const large = slice > Math.PI ? 1 : 0;
            const x1 = cx + Math.cos(a1) * rad;
            const y1 = cy + Math.sin(a1) * rad;
            const x2 = cx + Math.cos(a2) * rad;
            const y2 = cy + Math.sin(a2) * rad;
            let d = '';
            if (innerRad > 0) {
              const ix1 = cx + Math.cos(a2) * innerRad;
              const iy1 = cy + Math.sin(a2) * innerRad;
              const ix2 = cx + Math.cos(a1) * innerRad;
              const iy2 = cy + Math.sin(a1) * innerRad;
              d = `M ${x1} ${y1} A ${rad} ${rad} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerRad} ${innerRad} 0 ${large} 0 ${ix2} ${iy2} Z`;
            } else {
              d = `M ${cx} ${cy} L ${x1} ${y1} A ${rad} ${rad} 0 ${large} 1 ${x2} ${y2} Z`;
            }
            return <path key={i} d={d} fill={palette[i % palette.length]} stroke="#FFFFFF" strokeWidth={2} />;
          });
        })()
      ) : (
        <>
          {/* Grid & Axes */}
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
            const gy = padT + plotH * (1 - t);
            return (
              <g key={i}>
                <line x1={padL} y1={gy} x2={padL + plotW} y2={gy} stroke="#E2E8F0" strokeWidth={1} />
                <text x={padL - 8} y={gy + 4} textAnchor="end" fontSize={12} fill="#64748B">
                  {Math.round(maxVal * t)}
                </text>
              </g>
            );
          })}
          <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#94A3B8" strokeWidth={1.5} />

          {/* Bars / Lines */}
          {el.chartType === 'bar' &&
            el.categories.map((cat, cIdx) => {
              const groupW = plotW / Math.max(1, el.categories.length);
              const barW = Math.max(6, (groupW * 0.72) / Math.max(1, el.series.length));
              const startX = padL + cIdx * groupW + groupW * 0.14;
              return (
                <g key={cIdx}>
                  {el.series.map((s, sIdx) => {
                    const val = Math.max(0, s.values[cIdx] ?? 0);
                    const bh = (val / maxVal) * plotH;
                    return (
                      <rect
                        key={sIdx}
                        x={startX + sIdx * barW}
                        y={padT + plotH - bh}
                        width={Math.max(3, barW - 2)}
                        height={bh}
                        fill={s.color}
                        rx={2}
                      />
                    );
                  })}
                  <text
                    x={padL + cIdx * groupW + groupW / 2}
                    y={padT + plotH + 18}
                    textAnchor="middle"
                    fontSize={12}
                    fill="#334155"
                  >
                    {cat.slice(0, 14)}
                  </text>
                </g>
              );
            })}

          {(el.chartType === 'line' || el.chartType === 'area') &&
            el.series.map((s, sIdx) => {
              const pts = s.values.map((v, i) => {
                const px =
                  padL +
                  (s.values.length > 1
                    ? (i / (s.values.length - 1)) * plotW
                    : plotW / 2);
                const py = padT + plotH - (Math.max(0, v) / maxVal) * plotH;
                return { x: px, y: py };
              });
              const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              return (
                <g key={sIdx}>
                  {el.chartType === 'area' && pts.length >= 2 && (
                    <path
                      d={`${d} L ${pts[pts.length - 1].x} ${padT + plotH} L ${pts[0].x} ${padT + plotH} Z`}
                      fill={s.color}
                      fillOpacity={0.22}
                    />
                  )}
                  <path d={d} fill="none" stroke={s.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                  {pts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={4.5} fill={s.color} stroke="#FFFFFF" strokeWidth={1.5} />
                  ))}
                </g>
              );
            })}
        </>
      )}

      {el.showLegend && el.series.length > 0 && (
        <g transform={`translate(${padL}, ${h - 22})`}>
          {el.series.map((s, idx) => (
            <g key={idx} transform={`translate(${idx * 130}, 0)`}>
              <rect x={0} y={0} width={12} height={12} rx={2} fill={s.color} />
              <text x={18} y={10} fontSize={12} fill="#334155">
                {s.name.slice(0, 14)}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
};

const ShapeView: React.FC<{
  el: PptxShapeElement;
  animStatus?: ElementAnimStatus;
  animNonce: number;
}> = ({ el, animStatus, animNonce }) => {
  const gradId = useMemo(() => `grad_${el.id}`, [el.id]);
  const patId = useMemo(() => `pat_${el.id}`, [el.id]);
  const markerHeadId = useMemo(() => `mh_${el.id}`, [el.id]);
  const markerTailId = useMemo(() => `mt_${el.id}`, [el.id]);

  const fillRef =
    el.fill.type === 'none'
      ? 'none'
      : el.fill.type === 'solid'
        ? el.fill.color
        : el.fill.type === 'gradient'
          ? `url(#${gradId})`
          : `url(#${patId})`;

  const strokeColor = el.stroke?.color || 'none';
  const strokeWidth = el.stroke?.width || 0;
  const dashArray = strokeDashArray(el.stroke?.dash, strokeWidth);
  const w = Math.max(1, el.width);
  const h = Math.max(1, el.height);
  const polyPts = getPresetPolygonPoints(el.presetGeom, w, h, el.adj);
  const isLine = el.presetGeom === 'line' || el.presetGeom === 'straightConnector1';

  const vJustify =
    el.verticalAlign === 'middle'
      ? 'center'
      : el.verticalAlign === 'bottom'
        ? 'flex-end'
        : 'flex-start';

  const hasParagraphAnims = animStatus && animStatus.paragraphStates.size > 0;

  return (
    <div className="w-full h-full relative">
      {/* Vector Shape Geometry */}
      {(el.fill.type !== 'none' || el.stroke) && (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          className="absolute inset-0 overflow-visible pointer-events-none"
        >
          <defs>
            {el.fill.type === 'gradient' && (
              el.fill.kind === 'radial' ? (
                <radialGradient id={gradId} cx="50%" cy="50%" r="65%">
                  {el.fill.stops.map((s, idx) => (
                    <stop key={idx} offset={`${s.pos}%`} stopColor={s.color} />
                  ))}
                </radialGradient>
              ) : (
                <linearGradient
                  id={gradId}
                  gradientTransform={`rotate(${el.fill.angleDeg - 90} 0.5 0.5)`}
                >
                  {el.fill.stops.map((s, idx) => (
                    <stop key={idx} offset={`${s.pos}%`} stopColor={s.color} />
                  ))}
                </linearGradient>
              )
            )}
            {el.fill.type === 'image' && (
              <pattern id={patId} width="1" height="1" patternContentUnits="objectBoundingBox">
                <image href={el.fill.src} width="1" height="1" preserveAspectRatio="none" />
              </pattern>
            )}
            {el.stroke?.headEnd && el.stroke.headEnd !== 'none' && (
              <marker id={markerHeadId} markerWidth="8" markerHeight="8" refX="2" refY="4" orient="auto">
                <path d="M8,1 L1,4 L8,7 Z" fill={strokeColor} />
              </marker>
            )}
            {el.stroke?.tailEnd && el.stroke.tailEnd !== 'none' && (
              <marker id={markerTailId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M1,1 L8,4 L1,7 Z" fill={strokeColor} />
              </marker>
            )}
          </defs>

          {isLine ? (
            <line
              x1={0}
              y1={h / 2}
              x2={w}
              y2={h / 2}
              stroke={strokeColor}
              strokeWidth={Math.max(1.5, strokeWidth)}
              strokeDasharray={dashArray}
              strokeLinecap="round"
              markerStart={el.stroke?.headEnd && el.stroke.headEnd !== 'none' ? `url(#${markerHeadId})` : undefined}
              markerEnd={el.stroke?.tailEnd && el.stroke.tailEnd !== 'none' ? `url(#${markerTailId})` : undefined}
            />
          ) : el.customPathD ? (
            <svg viewBox={`0 0 ${el.customPathW || 1000} ${el.customPathH || 1000}`} width={w} height={h} preserveAspectRatio="none">
              <path
                d={el.customPathD}
                fill={fillRef}
                stroke={strokeColor}
                strokeWidth={strokeWidth * ((el.customPathW || w) / w)}
                strokeDasharray={dashArray}
              />
            </svg>
          ) : el.presetGeom === 'ellipse' ? (
            <ellipse
              cx={w / 2}
              cy={h / 2}
              rx={w / 2}
              ry={h / 2}
              fill={fillRef}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
            />
          ) : polyPts ? (
            <polygon
              points={polyPts}
              fill={fillRef}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeLinejoin="round"
            />
          ) : (
            <rect
              x={0}
              y={0}
              width={w}
              height={h}
              rx={
                el.presetGeom === 'roundRect'
                  ? Math.min(w, h) * (el.adj?.[0] ?? 0.14)
                  : 0
              }
              fill={fillRef}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
            />
          )}
        </svg>
      )}

      {/* Rich Text Body */}
      {el.paragraphs.length > 0 && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            padding: `${el.insets.t}px ${el.insets.r}px ${el.insets.b}px ${el.insets.l}px`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: vJustify,
            overflow: 'visible',
          }}
        >
          {el.paragraphs.map((p, idx) => {
            const pState = hasParagraphAnims
              ? animStatus?.paragraphStates.get(idx)
              : undefined;
            const visible = pState ? pState.visible : true;
            const animStyle = pState?.activeEffect
              ? getKeyframeAnimationStyle(pState.activeEffect)
              : undefined;
            return (
              <ParagraphView
                key={idx}
                p={p}
                visible={visible}
                animStyle={animStyle}
                animKey={pState?.activeEffect ? `${idx}-${animNonce}` : `${idx}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

const ImageView: React.FC<{ el: PptxImageElement }> = ({ el }) => {
  const crop = el.crop || { l: 0, t: 0, r: 0, b: 0 };
  const visW = Math.max(0.05, 1 - crop.l - crop.r);
  const visH = Math.max(0.05, 1 - crop.t - crop.b);
  const borderRadius =
    el.clipGeom === 'ellipse'
      ? '50%'
      : el.clipGeom === 'roundRect'
        ? '14px'
        : undefined;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderRadius,
        border: el.stroke ? `${el.stroke.width}px solid ${el.stroke.color}` : undefined,
      }}
    >
      <img
        src={el.src}
        alt=""
        draggable={false}
        style={{
          width: `${(100 / visW).toFixed(2)}%`,
          height: `${(100 / visH).toFixed(2)}%`,
          maxWidth: 'none',
          transform: `translate(${(-crop.l * 100).toFixed(2)}%, ${(-crop.t * 100).toFixed(2)}%)`,
          objectFit: 'fill',
          display: 'block',
        }}
      />
    </div>
  );
};

const TableView: React.FC<{ el: PptxTableElement }> = ({ el }) => {
  return (
    <table
      style={{
        width: el.width,
        height: el.height,
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
      }}
    >
      <colgroup>
        {el.colWidths.map((cw, idx) => (
          <col key={idx} style={{ width: cw }} />
        ))}
      </colgroup>
      <tbody>
        {el.rows.map((row, rIdx) => (
          <tr key={rIdx} style={{ height: el.rowHeights[rIdx] }}>
            {row.map((cell, cIdx) => {
              if (cell.hMerge || cell.vMerge) return null;
              const b = cell.borders;
              return (
                <td
                  key={cIdx}
                  colSpan={cell.gridSpan}
                  rowSpan={cell.rowSpan}
                  style={{
                    ...fillToCss(cell.fill),
                    verticalAlign: cell.verticalAlign,
                    padding: '6px 10px',
                    borderTop: b?.top
                      ? `${b.top.width}px solid ${b.top.color}`
                      : '1px solid rgba(148,163,184,0.35)',
                    borderRight: b?.right
                      ? `${b.right.width}px solid ${b.right.color}`
                      : '1px solid rgba(148,163,184,0.35)',
                    borderBottom: b?.bottom
                      ? `${b.bottom.width}px solid ${b.bottom.color}`
                      : '1px solid rgba(148,163,184,0.35)',
                    borderLeft: b?.left
                      ? `${b.left.width}px solid ${b.left.color}`
                      : '1px solid rgba(148,163,184,0.35)',
                  }}
                >
                  {cell.paragraphs.map((p, pIdx) => (
                    <ParagraphView key={pIdx} p={p} visible />
                  ))}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export const PptxSlideStage: React.FC<PptxSlideStageProps> = ({
  slide,
  width,
  height,
  stepIndex,
  justTriggeredStep,
  animNonce,
}) => {
  const animMap = useMemo(
    () => evaluateAnimations(slide, stepIndex, justTriggeredStep),
    [slide, stepIndex, justTriggeredStep]
  );

  return (
    <div
      style={{
        width,
        height,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        ...fillToCss(slide.background),
      }}
    >
      {slide.elements.map((el) => {
        const status = animMap.get(el.shapeId);
        const visible = status ? status.visible : true;
        const activeEff = status?.activeEffect || null;
        const animStyle = getKeyframeAnimationStyle(activeEff);

        const baseTransform = [
          el.rotation ? `rotate(${el.rotation}deg)` : '',
          el.flipH ? 'scaleX(-1)' : '',
          el.flipV ? 'scaleY(-1)' : '',
        ]
          .filter(Boolean)
          .join(' ');

        const filterShadow =
          'shadow' in el && el.shadow
            ? `drop-shadow(${el.shadow.offsetX}px ${el.shadow.offsetY}px ${el.shadow.blur}px ${el.shadow.color})`
            : undefined;

        return (
          <div
            key={activeEff ? `${el.id}-${animNonce}` : el.id}
            style={{
              position: 'absolute',
              left: el.x,
              top: el.y,
              width: el.width,
              height: el.height,
              transform: baseTransform || undefined,
              transformOrigin: 'center center',
              opacity: visible ? (el.opacity ?? 1) : 0,
              visibility: visible ? 'visible' : 'hidden',
              pointerEvents: 'none',
              filter: filterShadow,
            }}
          >
            <div style={{ width: '100%', height: '100%', ...animStyle }}>
              {el.kind === 'shape' && (
                <ShapeView el={el} animStatus={status} animNonce={animNonce} />
              )}
              {el.kind === 'image' && <ImageView el={el} />}
              {el.kind === 'table' && <TableView el={el} />}
              {el.kind === 'chart' && <ChartSvgView el={el} />}
            </div>
          </div>
        );
      })}
    </div>
  );
};
