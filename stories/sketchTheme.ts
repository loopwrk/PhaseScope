/* Story decorator that scopes a story under Sketch's paper theme
   (tokens/sketch.css) - the equivalent of mounting inside SketchShell. */
export const sketchTheme = () => ({
    template: '<div class="sketch-theme" style="padding:32px"><story /></div>',
});
