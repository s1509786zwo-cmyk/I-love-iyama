# 3-map chain release

URLs: https://files.catbox.moe/33qxzs.glb (53,686,948 bytes), https://files.catbox.moe/pt7rsw.glb (48,493,172 bytes), https://files.catbox.moe/wth21z.glb (60,364,724 bytes). Each HTTP200 and valid GLB2 JSON.

Native door survey (original world coordinates): room1 entrance [1.516,1.8,1.807], normal [-.668,0,-.744]; exit [-5.88,1.8,1.98], normal [.745,0,-.668]. room2 entrance [-1.64,1.55,-2.175], normal [0,0,1]; exit [3.055,1.35,-.30], normal [-1,0,0]. room3 entrance [-8.438,-.06,-7.08], normal [1,0,0]. Floor refs .476/.254/-1.30. Source units maintained via measured full BBox heights. No new rendering objects in chain scenes. Original interiors confirmed in inspection captures.

Regression: browser_checks/chain-live-result.log all routes + exact nested returns + existing rooms + controls + stairs + zero JS errors PASS. chain-navigation2.log 503 restore, strict aim, floor-path reachability PASS. chain-still2.log real single-frame renders of all three rooms PASS. Full-render RAF test screenshot timeout on software renderer; no 60fps guarantee. Original full nonindexed BVH caused OOM; indexed position-only BVH and no application GLB cache fixed live regression. Playwright large-response-fulfill regression hit memory limit; direct live asset requests passed.

Complete readable source: main.js + maps.js + template.html; build.py creates uncompressed single index.html. complete.html and root GRAND_ATLAS_本物の扉_完全版.html embed exactly the release app.js in gzip/base64, tested bootstrap PASS. CDNs and models remain network dependencies. New asset authors/licenses unknown; user supplied URLs, rights confirmation required for publication.

Large downloaded GLB scratch copies were removed after inspection to keep workspace snapshots small. They can be retrieved again from the URLs above.
