# Deploy to OpenShift

## Runtime Setup
TBD

## Deployment
TBD

### Change Propagation
To promote runtime image from one environment to another, for example from *dev* to *test*, run

```
oc tag <yourprojectname-tools>/mygovbc-spa-env-server:latest <yourprojectname-test>/mygovbc-spa-env-server:latest <yourprojectname-tools>/mygovbc-spa-env-server:test
```
The above command will deploy the latest/dev runtime image to *test* env. The purpose of tagging runtime image of *test* env in both \<yourprojectname-test\>/mygovbc-spa-env-server:latest and \<yourprojectname-tools\>/mygovbc-spa-env-server:test is to use \<yourprojectname-tools\>/mygovbc-spa-env-server:test as backup such that in case the image stream \<yourprojectname-test\>/mygovbc-spa-env-server, which is used by *test* runtime pods, is deleted inadvertently, it can be recovered from \<yourprojectname-tools\>/mygovbc-spa-env-server:test.

The command can be setup as a Jenkins task to faciliate using Jenkins to orchestrate deployment of entire application, as is the case.

## Tips
To find source code commit point of a runtime instance on OpenShift, open a terminal on one of the running pods and run command `git rev-parse HEAD` in cwd.
