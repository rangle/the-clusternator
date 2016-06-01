---
layout: guide-dev
title: Navigating The Source
permalink: /guide/dev/source
---

Complete [API documentation](/api/ "API Documentation") is available.  This
guide aims to help developers navigate the API documentation and the actual
source from which it is generated.

The source code is divided into the following modules:

- AWS API `src/aws/` which provides a promise based interface for dealing with
Amazon Web Services.  AWS is the first (and currently only) cloud service
provider supported by Clusternator
- Clusternator API `src/clusternator/*` which provides a promise based _client_
interface for deailing with a Clusternator server interface which in turn maps
to a cloud service API.
- Clusternator public APIs `src/api/*` which is a collection of API's for use
by Clusternator users or consumers of the Clusternator.  These public API's are
divided into:
    - CLI the command line api
    - REST the RESTful (web server) API
    - project-fs the API for managing source code based project files
    - js the API exposed by The Clusternator node module. This API essentially
      maps calls from its siblings into the system
- CLI Wrappers `src/cli-wrappers` CLI based commands wrapped into promise based
node processes
- The Clusternator Server `src/server` which is where the Express based server
code lives
- There are also common scripts located in `src/*` as well as a few
"accidentals" like `bin/*`
