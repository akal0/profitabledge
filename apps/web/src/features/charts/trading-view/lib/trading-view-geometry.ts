"use client";

export function getRayProjection(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  height: number
) {
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (Math.abs(dx) < 0.0001) {
    return {
      x: x2,
      y: dy >= 0 ? height : 0,
    };
  }

  const targetX = dx >= 0 ? width : 0;
  const ratio = (targetX - x1) / dx;
  const projectedY = y1 + dy * ratio;

  if (projectedY >= 0 && projectedY <= height) {
    return { x: targetX, y: projectedY };
  }

  const targetY = dy >= 0 ? height : 0;
  const yRatio = (targetY - y1) / dy;

  return {
    x: x1 + dx * yRatio,
    y: targetY,
  };
}

export function getArrowHeadPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLength = 10;
  const leftX = x2 - headLength * Math.cos(angle - Math.PI / 7);
  const leftY = y2 - headLength * Math.sin(angle - Math.PI / 7);
  const rightX = x2 - headLength * Math.cos(angle + Math.PI / 7);
  const rightY = y2 - headLength * Math.sin(angle + Math.PI / 7);

  return `${x2},${y2} ${leftX},${leftY} ${rightX},${rightY}`;
}

export function getExtendedLineProjection(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  height: number
) {
  const forward = getRayProjection(x1, y1, x2, y2, width, height);
  const backward = getRayProjection(x2, y2, x1, y1, width, height);

  return {
    start: backward,
    end: forward,
  };
}
