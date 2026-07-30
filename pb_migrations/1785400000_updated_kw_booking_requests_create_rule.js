/// <reference path="../pb_data/types.d.ts" />
// createRule bleibt öffentlich (""). Status-Zwang "pending" läuft im Hook
// onRecordCreateRequest (PB 0.39: createRule mit status-Vergleich blockiert sonst alle Creates).
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1394588684")
  collection.createRule = ""
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1394588684")
  collection.createRule = ""
  return app.save(collection)
})
