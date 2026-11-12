# Onboarding artwork

The first-run editorial page is an illustration of the planning flow. Its crowd photograph does not depict the active festival or the pictured CRSSD 2026 set.

- `onboarding-crowd-unsplash.jpg`: red laser concert crowd by Marc-André Paradis, [Unsplash source](https://unsplash.com/photos/people-dancing-under-red-laser-lights-at-a-concert-5hcYSWUc9Kw), August 18, 2025. The source labels this photo free under the Unsplash License. [Unsplash terms](https://unsplash.com/terms) permit copying, adapting, distributing and commercial use without attribution, but exclude separately protected recognizable people, brands or artwork; this image shows silhouettes and unmarked lights. It is a generic atmosphere, not a CRSSD photograph.

The crowd asset is held locally and copied into the iOS bundle by `scripts/build.mjs`, and listed in the service worker's atomic offline precache. Do not replace them with an official, press or editorial photo merely because it is downloadable: bundling needs an actual reuse grant. Avoid suggesting the photo is from an event it does not depict.
