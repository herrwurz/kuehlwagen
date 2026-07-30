/// <reference path="../pb_data/types.d.ts" />
// Öffentliches Create erzwingen: Status muss "pending" sein (kein approved/rejected per API-Spam).
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1394588684")
  collection.createRule = "@request.data.status = \"pending\""
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1394588684")
  collection.createRule = ""
  return app.save(collection)
})
