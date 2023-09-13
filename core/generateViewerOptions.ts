import { Options } from 'openseadragon';

export const SVG_ID = 'drawingSvg';

export const generateViewerOptions: (id: string, imageUrl: string) => Options = (
  id: string,
  imageUrl: string
): Options => {
  return {
    id,
    prefixUrl: 'https://openseadragon.github.io/openseadragon/images/',
    tileSources: {
      type: 'image',
      url: imageUrl,
    },
    // tileSources: 'https://cg.noxz.dev/big.dzi',
    animationTime: 0.4,
    blendTime: 0.1,
    constrainDuringPan: true,
    maxZoomPixelRatio: 3,
    minZoomImageRatio: 0.25,
    visibilityRatio: 0.1,
    zoomPerScroll: 1.75,
    debugMode: false,
    gestureSettingsMouse: {
      clickToZoom: false
    },
    // showNavigator: true,
    // navigatorPosition: 'BOTTOM_LEFT',
    navigatorHeight: 150,
    navigatorWidth: 150,
    showNavigationControl: false
  };
};

