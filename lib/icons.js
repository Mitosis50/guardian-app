const { nativeImage } = require('electron')

const COLORS = {
  idle: '#9ca3af',
  active: '#22c55e',
  alert: '#facc15',
  error: '#ef4444'
}

function createTrayIcon() {
  // Return a minimal 1x1 transparent image — title/emoji handles display
  return nativeImage.createEmpty()
}

module.exports = { createTrayIcon }
