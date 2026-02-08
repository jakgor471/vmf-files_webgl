# WebGL VMF Preview + Article
WebGL viewer for VMF Files (Hammer Editor maps) made in JavaScript.
The whole documentation of the process is available in the article (see ```vmffiles.pdf```).

**The interactive demo is available here**: [https://jakgor471.github.io/vmf-files_webgl/](https://jakgor471.github.io/vmf-files_webgl/)

About the project🔍
===================

My fascination with **Valve Map Format** started around the year 2020, when I was planning on creating an addon for Garry's Mod that would allow importing VMF prefabs into the game and using them as regular props. I've stumbled upon an article by [Stefan Hajnoczi](https://github.com/stefanha/map-files) and tried following it, to no avail due to lack of mathematical knowledge and intuition on my part.

Years later, shortly after starting the _Mathematical analysis and linear algebra_ course at the university I've decided to revisit this project. I went with a different approach then Hajnoczi's - instead of _intersection method_ I chose _clipping method_ known from Quake. This time I understood every single formula, this way I was able to troubleshoot any problems. As a _culmination_ I wrote an article on that topic, describing in details the entire process - it can be found [here](https://github.com/jakgor471/vmf-files_webgl/blob/main/vmffiles.pdf).

If it comes to the purpose of this demo I wanted to visualize the process of converting brushes into meshes. Additionaly, this app serves a purpose of a primitive VMF viewer - you can quickly preview and explore a map without Hammer Editor, which is cool!


AI disclosure🗿
===============

Yes, I've used ChatGPT to prettify the CSS for this project, but only for that. What about dead-giveaway-emoticons? I've placed them manually, I just really like them easthetically. Oh and I've used ChatGPT to verify my cross product while deriving a 3 plane intersection formula. There was a small mistake and I was going crazy trying to find it. All it took was flipping the sign 😑