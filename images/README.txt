IMAGES FOLDER — Miami Beach Botanical Garden website
=====================================================

The site currently uses NO photos. Every visual panel is a botanical
SVG illustration drawn in code, so nothing is broken and nothing
needs replacing.

If you want to add real photography later:

1. Save your photos in this folder (e.g. garden-hero.jpg, wedding.jpg).
2. Find a decorative panel in the HTML — they look like this:

     <div class="block-media" aria-hidden="true">
       <svg class="deco" ...>...</svg>
     </div>

3. Replace the <svg> with an image tag:

     <div class="block-media" style="padding: 0;">
       <img src="images/garden-hero.jpg" alt="Describe the photo"
            style="width: 100%; height: 100%; object-fit: cover;">
     </div>

The same works for the three gallery cards on private-events.html —
swap each small <svg> for an <img>.

Recommended sizes: hero/side panels ~1200px wide, gallery ~800px wide.
