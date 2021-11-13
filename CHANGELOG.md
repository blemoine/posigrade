# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.3.0](https://github.com/blemoine/posigrade/compare/v1.2.0...v1.3.0) (2021-11-13)


### Features

* **deser:** ensure DeserDefinition don't throw ([3d96bc1](https://github.com/blemoine/posigrade/commit/3d96bc124d8fbb7729c48b1ee0f5c1f82f58364b))

## [1.2.0](https://github.com/blemoine/posigrade/compare/v1.1.0...v1.2.0) (2021-11-12)


### Features

* **deserializers:** add support for arrays ([b9a3c8f](https://github.com/blemoine/posigrade/commit/b9a3c8f1a1b3408d64eb8243266d29a9311b5e33))

## [1.1.0](https://github.com/blemoine/posigrade/compare/v1.0.0...v1.1.0) (2021-11-11)


### Features

* **query:** add support for arbitrary type for values ([e3e0268](https://github.com/blemoine/posigrade/commit/e3e0268f251a73519bd97fd74931bee07a30b375))

## [1.0.0](https://github.com/blemoine/posigrade/compare/v0.0.20...v1.0.0) (2021-11-10)

### [0.0.20](https://github.com/blemoine/posigrade/compare/v0.0.19...v0.0.20) (2021-11-10)


### Features

* **query:** add sequence support ([ea4fc7d](https://github.com/blemoine/posigrade/commit/ea4fc7d330d05fe00948dc37232cac0b4eee9dda))

### [0.0.19](https://github.com/blemoine/posigrade/compare/v0.0.18...v0.0.19) (2021-11-10)


### Bug Fixes

* **deserializers:** fix again parsing of decimals ([2a7df5f](https://github.com/blemoine/posigrade/commit/2a7df5f0883e6c7aaabba805fee9a50c00300d4c))

### [0.0.18](https://github.com/blemoine/posigrade/compare/v0.0.17...v0.0.18) (2021-11-10)


### Bug Fixes

* **deserializers:** support parsing of floats ending with 0 ([4311a77](https://github.com/blemoine/posigrade/commit/4311a77b2508ad05b63abf85d065dd13cfe4fe94))

### [0.0.17](https://github.com/blemoine/posigrade/compare/v0.0.16...v0.0.17) (2021-11-10)


### Bug Fixes

* fix deserializer type ([82a1dc3](https://github.com/blemoine/posigrade/commit/82a1dc322f1f392093af753bc49bde6db89a6d26))

### [0.0.16](https://github.com/blemoine/posigrade/compare/v0.0.15...v0.0.16) (2021-11-10)


### Features

* **deserializer:** add string to number deserializer ([c89772a](https://github.com/blemoine/posigrade/commit/c89772a602a6e66bffe187e29327d74e7f5a1e6e))

### [0.0.15](https://github.com/blemoine/posigrade/compare/v0.0.14...v0.0.15) (2021-11-08)


### Features

* **executor:** add a close method ([8072aca](https://github.com/blemoine/posigrade/commit/8072acaa4452de9d9ab59b5818dbda3e32966fb2))

### [0.0.14](https://github.com/blemoine/posigrade/compare/v0.0.13...v0.0.14) (2021-11-07)


### Features

* **deserializer:** add `fromTuple` method ([fea6d0a](https://github.com/blemoine/posigrade/commit/fea6d0ac66db671d7a63ce9d7301fe621d371e2e))
* **deserializers:** add `chain` method ([89f7e80](https://github.com/blemoine/posigrade/commit/89f7e803e4fc12e76b0d6f16cceefa0e4a1b7f4e))

### [0.0.13](https://github.com/blemoine/posigrade/compare/v0.0.12...v0.0.13) (2021-11-07)


### Features

* **deser:** add support for boolean ([f358e5e](https://github.com/blemoine/posigrade/commit/f358e5e019bbff757cf05a5eb31a071f7af8fa2c))


### Bug Fixes

* **deserializer:** support for interface ([02ed8da](https://github.com/blemoine/posigrade/commit/02ed8dae174150d9bbf6df4d789f6d311b0f7940))

### [0.0.12](https://github.com/blemoine/posigrade/compare/v0.0.11...v0.0.12) (2021-11-05)


### Features

* **deserializers:** add `transform` method ([0dcc248](https://github.com/blemoine/posigrade/commit/0dcc248ce381e1461299449a0e0de304a2a5dc48))

### [0.0.11](https://github.com/blemoine/posigrade/compare/v0.0.10...v0.0.11) (2021-11-05)

### [0.0.10](https://github.com/blemoine/posigrade/compare/v0.0.9...v0.0.10) (2021-11-04)

### [0.0.9](https://github.com/blemoine/posigrade/compare/v0.0.8...v0.0.9) (2021-11-03)

### [0.0.8](https://github.com/blemoine/posigrade/compare/v0.0.7...v0.0.8) (2021-11-03)


### Features

* **author:** add create save ([d38dde0](https://github.com/blemoine/posigrade/commit/d38dde042a0aa1905f4bdc4a4897d00aeac9a51b))
* **authors:** get all authors ([2adb251](https://github.com/blemoine/posigrade/commit/2adb251364f9901bfc8e9d7cff04c9d9b6d3bb7c))
* **deser:** add orNull shortcut ([d72ed00](https://github.com/blemoine/posigrade/commit/d72ed00a1712036f6689ce5ee489891ef62e9cbe))
* **executor:** introduce executor ([abe1419](https://github.com/blemoine/posigrade/commit/abe1419114aa3a521a674bb8591bed634f7f220f))
* **orNull:** orNull for named sql deserializer ([978eaac](https://github.com/blemoine/posigrade/commit/978eaac8e063262def93bd1eba122748af383248))
* **positionDeser:** support for orNull helper ([e360eb3](https://github.com/blemoine/posigrade/commit/e360eb333e4ba337858c0bb8edcc61ea94eea6b1))


### Bug Fixes

* **sqlparser:** add support for fragment without params ([52263eb](https://github.com/blemoine/posigrade/commit/52263eba88b666f601cc5d3a3230dd38458566ca))

# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.
