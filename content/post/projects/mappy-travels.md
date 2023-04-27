---
title: "🌎 A map of our 2023 travels 🌎"
date: "2023-04-27 17:22:00+07:00"
summary: "Visualising a year on the road"
tags: [projects]
weight: 1
---

This blog has been brilliant at helping me express the experiences we've had, making it simple to share stories, and will hopefully form a record we can relish for years after this trip ends.

But where's the data? I also want the time, distance and costs. Photos and feelings are all well and good, but also give me some cold, hard numbers.

A year long adventure. What an opportunity for a nerd to collect, visualise and share lots of figures.

I've been stuffing stats into a spreadsheet since the start of the year, and have been hacking away on a method of visualising it.

This post will be updated as our voyage continues:

{{< mappyTravels  autostart="yes" >}}

And "destination" posts will have a logistical section 🤓

# The nerd zone
 
A slight word on how this fits together, I know you geeks are out there.

## Data sources

Road and rail routes are mostly sourced using a script I wrote, which calls the Google directions API. 

Maritime routes are mostly also obtained from the Google directions API, but less official crossings have been drawn by my fair hand with [geojson.io](https://geojson.io).

Flight routes are actual, exported from [flightradar24.com](https://flightradar24.com).

Laura would also like me to point out that asking her  "what time did that bus we got (three weeks ago) arrive?" is not a very accurate way of measuring journey times. (Despite her having an excellent memory 💪).

## Mashing it together

All the data is mixed into the aforementioned spreadsheet, which looks something like this:

{{< gallery album="mappy-travels-spreadsheet" >}}

I then export it to JSON using [this excellent Google Apps Script](http://blog.pamelafox.org/2013/06/exporting-google-spreadsheet-as-json.html?m=1).

Yet another script is then run on this JSON. It's based on [simplify-js](https://mourner.github.io/simplify-js/) and uses the [Douglas-Peucker algorithm](https://en.m.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm) to remove points in a curve that don't pull their weight enough. For example, it reduces our flight from Barcelona to Singapore from being 1455 points to 279 points - and only causes a 930m loss in total distance.

## Displaying it

The mashed JSON is fed into my blog as a resource. The blog itself uses the excellent [Hugo](https://gohugo.io) static site generator. HTML tables are spat out based on the JSON, and I wrote some typescript glue that uses the magnificent [maplibre](https://maplibre.org/) to draw/animate it all on a map. 

## Scaling

It's a bit of manual effort to maintain at the moment, but we're not transferring frequently enough for it to be too much of a burden. I'm sure I'll end up making improvements to the method of collating it all as time goes on.

Data wise, all the the mashed JSON is 121kb. We're 30% of the way through our trip (☹️), so I think that should be reasonable. If not I'll have to scratch the noggin' a bit.