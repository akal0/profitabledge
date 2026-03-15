"use client";

import { useEffect, useMemo, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type LineData,
  type LineWidth,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";

import { serializeTime } from "@/features/charts/trading-view/lib/trading-view-utils";
import type {
  CandleData,
  IndicatorLine,
  PriceLine,
  TradeMarker,
} from "@/features/charts/trading-view/lib/trading-view-types";

type UseTradingViewChartCoreArgs = {
  data: CandleData[];
  markers: TradeMarker[];
  priceLines: PriceLine[];
  indicatorLines: IndicatorLine[];
  width: number | string;
  height: number;
  autosize: boolean;
  theme: "dark" | "light";
  showVolume: boolean;
  fitContent: boolean;
  visibleRange?: { from: Time; to: Time };
  onCrosshairMove?: (price: number | null, time: Time | null) => void;
  onTimeRangeChange?: (from: Time, to: Time) => void;
  scheduleViewportSync: () => void;
  chartWrapperRef: RefObject<HTMLDivElement | null>;
  chartContainerRef: RefObject<HTMLDivElement | null>;
  chartRef: MutableRefObject<IChartApi | null>;
  candleSeriesRef: MutableRefObject<ISeriesApi<"Candlestick"> | null>;
  volumeSeriesRef: MutableRefObject<ISeriesApi<"Histogram"> | null>;
  indicatorSeriesRef: MutableRefObject<Map<string, ISeriesApi<"Line">>>;
  priceLinesRef: MutableRefObject<IPriceLine[]>;
  markersPluginRef: MutableRefObject<ISeriesMarkersPluginApi<Time> | null>;
  lastFittedDatasetRef: MutableRefObject<{ startTime: string; length: number } | null>;
  setOverlaySize: Dispatch<SetStateAction<{ width: number; height: number }>>;
};

export function useTradingViewChartCore({
  data,
  markers,
  priceLines,
  indicatorLines,
  width,
  height,
  autosize,
  theme,
  showVolume,
  fitContent,
  visibleRange,
  onCrosshairMove,
  onTimeRangeChange,
  scheduleViewportSync,
  chartWrapperRef,
  chartContainerRef,
  chartRef,
  candleSeriesRef,
  volumeSeriesRef,
  indicatorSeriesRef,
  priceLinesRef,
  markersPluginRef,
  lastFittedDatasetRef,
  setOverlaySize,
}: UseTradingViewChartCoreArgs) {
  const colors = useMemo(() => {
    if (theme === "dark") {
      return {
        background: "transparent",
        textColor: "rgba(255, 255, 255, 0.5)",
        gridColor: "rgba(255, 255, 255, 0.05)",
        borderColor: "rgba(255, 255, 255, 0.1)",
        upColor: "#00E0C8",
        downColor: "#F76290",
        wickUpColor: "#00E0C8",
        wickDownColor: "#F76290",
        volumeUp: "rgba(0, 224, 200, 0.3)",
        volumeDown: "rgba(247, 98, 144, 0.3)",
        crosshairColor: "rgba(255, 255, 255, 0.3)",
      };
    }

    return {
      background: "transparent",
      textColor: "rgba(0, 0, 0, 0.5)",
      gridColor: "rgba(0, 0, 0, 0.05)",
      borderColor: "rgba(0, 0, 0, 0.1)",
      upColor: "#26a69a",
      downColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      volumeUp: "rgba(38, 166, 154, 0.3)",
      volumeDown: "rgba(239, 83, 80, 0.3)",
      crosshairColor: "rgba(0, 0, 0, 0.3)",
    };
  }, [theme]);

  useEffect(() => {
    if (!chartContainerRef.current || !chartWrapperRef.current) return;

    const containerWidth =
      typeof width === "number" && width > 0 ? width : chartWrapperRef.current.clientWidth;
    const containerHeight =
      height > 0 ? height : chartWrapperRef.current.clientHeight || 400;

    const chart = createChart(chartContainerRef.current, {
      width: containerWidth,
      height: containerHeight,
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.textColor,
      },
      grid: {
        vertLines: { color: colors.gridColor },
        horzLines: { color: colors.gridColor },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: colors.crosshairColor,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: theme === "dark" ? "#1a1a2e" : "#ffffff",
        },
        horzLine: {
          color: colors.crosshairColor,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: theme === "dark" ? "#1a1a2e" : "#ffffff",
        },
      },
      rightPriceScale: {
        borderColor: colors.borderColor,
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.2 : 0.1,
        },
      },
      timeScale: {
        borderColor: colors.borderColor,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        vertTouchDrag: false,
      },
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: colors.upColor,
      downColor: colors.downColor,
      borderVisible: false,
      wickUpColor: colors.wickUpColor,
      wickDownColor: colors.wickDownColor,
    });
    candleSeriesRef.current = candleSeries;
    markersPluginRef.current = createSeriesMarkers(candleSeries);

    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: colors.volumeUp,
        priceFormat: { type: "volume" },
        priceScaleId: "",
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.85,
          bottom: 0,
        },
      });
      volumeSeriesRef.current = volumeSeries;
    }

    if (onCrosshairMove) {
      chart.subscribeCrosshairMove((param) => {
        if (!param.time || !param.point) {
          onCrosshairMove(null, null);
          return;
        }

        const seriesData = param.seriesData.get(candleSeries) as CandlestickData<Time> | undefined;
        onCrosshairMove(seriesData?.close ?? null, param.time);
      });
    }

    if (onTimeRangeChange) {
      chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
        if (range) {
          onTimeRangeChange(range.from as Time, range.to as Time);
        }
        scheduleViewportSync();
      });
    } else {
      chart.timeScale().subscribeVisibleTimeRangeChange(() => {
        scheduleViewportSync();
      });
    }

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      scheduleViewportSync();
    });

    let resizeObserver: ResizeObserver | null = null;
    setOverlaySize({ width: containerWidth, height: containerHeight });

    if (autosize && chartWrapperRef.current) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width: nextWidth, height: nextHeight } = entry.contentRect;
          if (nextWidth > 0 && nextHeight > 0) {
            chart.applyOptions({ width: nextWidth, height: nextHeight });
            setOverlaySize({ width: nextWidth, height: nextHeight });
          }
        }
      });
      resizeObserver.observe(chartWrapperRef.current);
    }

    const indicatorSeries = indicatorSeriesRef.current;

    return () => {
      resizeObserver?.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      indicatorSeries.clear();
      markersPluginRef.current = null;
    };
  }, [
    autosize,
    candleSeriesRef,
    chartContainerRef,
    chartRef,
    chartWrapperRef,
    colors,
    height,
    indicatorSeriesRef,
    markersPluginRef,
    onCrosshairMove,
    onTimeRangeChange,
    scheduleViewportSync,
    setOverlaySize,
    showVolume,
    theme,
    volumeSeriesRef,
    width,
  ]);

  useEffect(() => {
    if (!candleSeriesRef.current || !data.length) return;

    const candleData: CandlestickData<Time>[] = data.map((candle) => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));
    candleSeriesRef.current.setData(candleData);

    if (volumeSeriesRef.current && showVolume) {
      const volumeData: HistogramData<Time>[] = data.map((candle) => ({
        time: candle.time,
        value: candle.volume || 0,
        color: candle.close >= candle.open ? colors.volumeUp : colors.volumeDown,
      }));
      volumeSeriesRef.current.setData(volumeData);
    }

    if (fitContent && chartRef.current) {
      const nextDataset = {
        startTime: serializeTime(data[0].time),
        length: data.length,
      };
      const lastDataset = lastFittedDatasetRef.current;
      const shouldFit =
        lastDataset === null ||
        lastDataset.startTime !== nextDataset.startTime ||
        nextDataset.length < lastDataset.length;

      if (shouldFit) {
        chartRef.current.timeScale().fitContent();
      }

      lastFittedDatasetRef.current = nextDataset;
    }
  }, [
    candleSeriesRef,
    chartRef,
    colors,
    data,
    fitContent,
    lastFittedDatasetRef,
    showVolume,
    volumeSeriesRef,
  ]);

  useEffect(() => {
    if (!markersPluginRef.current) return;

    const chartMarkers: SeriesMarker<Time>[] = markers.map((marker) => ({
      time: marker.time,
      position: marker.position,
      color: marker.color,
      shape: marker.shape,
      text: marker.text,
      size: marker.size || 1,
    }));

    markersPluginRef.current.setMarkers(chartMarkers);
  }, [markers, markersPluginRef]);

  useEffect(() => {
    if (!candleSeriesRef.current) return;

    priceLinesRef.current.forEach((line) => {
      candleSeriesRef.current?.removePriceLine(line);
    });
    priceLinesRef.current = [];

    priceLines.forEach((line) => {
      const lineStyle =
        line.lineStyle === "dashed"
          ? LineStyle.Dashed
          : line.lineStyle === "dotted"
            ? LineStyle.Dotted
            : LineStyle.Solid;

      const priceLine = candleSeriesRef.current?.createPriceLine({
        price: line.price,
        color: line.color,
        lineWidth: line.lineWidth || 1,
        lineStyle,
        title: line.title || "",
        axisLabelVisible: line.axisLabelVisible ?? true,
      });

      if (priceLine) {
        priceLinesRef.current.push(priceLine);
      }
    });
  }, [candleSeriesRef, priceLines, priceLinesRef]);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = chartRef.current;
    const currentSeriesMap = indicatorSeriesRef.current;
    const nextIds = new Set(indicatorLines.map((line) => line.id));

    currentSeriesMap.forEach((series, id) => {
      if (!nextIds.has(id)) {
        chart.removeSeries(series);
        currentSeriesMap.delete(id);
      }
    });

    indicatorLines.forEach((line) => {
      if (line.data.length === 0) return;

      let series = currentSeriesMap.get(line.id);
      if (!series) {
        const lineStyle =
          line.lineStyle === "dashed"
            ? LineStyle.Dashed
            : line.lineStyle === "dotted"
              ? LineStyle.Dotted
              : LineStyle.Solid;

        series = chart.addSeries(LineSeries, {
          color: line.color,
          lineWidth: (line.lineWidth || 2) as LineWidth,
          lineStyle,
          priceScaleId: line.priceScaleId ?? "right",
          title: line.title || "",
          lastValueVisible: false,
          priceLineVisible: false,
        });
        currentSeriesMap.set(line.id, series);
      }

      const lineData: LineData<Time>[] = line.data.map((point) => ({
        time: point.time,
        value: point.value,
      }));
      series.setData(lineData);
    });
  }, [chartRef, indicatorLines, indicatorSeriesRef]);

  useEffect(() => {
    if (!chartRef.current || !visibleRange) return;
    chartRef.current.timeScale().setVisibleRange(visibleRange);
  }, [chartRef, visibleRange]);
}
