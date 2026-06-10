/**
 * Utility to detect if the client is a mobile device (phone or tablet).
 * Checks User Agent, touch screen support, and viewport width.
 */
export function isMobile() {
  const uaMatch = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const touchSupport = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const smallScreen = window.innerWidth <= 1024; // Standard breakpoint for tablets/phones
  
  return uaMatch || (touchSupport && smallScreen);
}
