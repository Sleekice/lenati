package org.lenati.client

import retrofit2.http.GET

/**
 * Read-only API of public Lenati catalog snapshots.
 * Use a repository-scoped base URL such as https://YOUR_USER.github.io/lenati/.
 * Production accounts and progress should use a separately authenticated service.
 */
interface LenatiApi {
    @GET("api/v1/structures.json") suspend fun structures(): List<AnatomyStructure>
    @GET("api/v1/paths.json") suspend fun paths(): List<Journey>
    @GET("api/v1/lenses.json") suspend fun lenses(): List<BodyLens>
}

data class AnatomyStructure(
    val id: String,
    val name: String,
    val system: String,
    val depth: String,
    val description: String,
    val source: String,
    val evidence: String,
    val mesh: String
)

data class Journey(val id: String, val name: String, val symbol: String, val steps: List<List<String>>, val source: String)
data class BodyLens(val id: Int, val name: String, val group: String, val description: String, val confidence: String)
