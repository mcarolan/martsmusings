import * as maplibreGl from "maplibre-gl";

import * as turf from "@turf/turf";
import { Feature, FeatureCollection, LineString } from "@turf/turf";
import { GeoJSONSource } from "maplibre-gl";
import { durationStringToMinutes, minutesToHuman } from "./duration";
import * as params from '@params';

const routeRequest = new Request(params.route);

enum Mode {
    Train = "Train",
    Plane = "Plane",
    Coach = "Coach",
    Ferry = "Ferry",
    Speedboat = "Speedboat",
    Minibus = "Minibus",
    LongBoat = "LongBoat",
    Tube = "Tube",
    Bus = "Bus",
    Taxi = "Taxi"
}

enum TransportCategory {
    Rail = "Rail",
    Air = "Air",
    Road = "Road",
    Sea = "Sea"
}

function allTransportCategories(): TransportCategory[] {
    return [
        TransportCategory.Air,
        TransportCategory.Rail,
        TransportCategory.Road,
        TransportCategory.Sea
    ];
}

function modeToCategory(mode: Mode): TransportCategory {
    switch (mode) {
        case Mode.Train: return TransportCategory.Rail;
        case Mode.Plane: return TransportCategory.Air;
        case Mode.Coach: return TransportCategory.Road;
        case Mode.Ferry: return TransportCategory.Sea;
        case Mode.Speedboat: return TransportCategory.Sea;
        case Mode.Minibus: return TransportCategory.Road;
        case Mode.LongBoat: return TransportCategory.Sea;
        case Mode.Tube: return TransportCategory.Rail;
        case Mode.Bus: return TransportCategory.Road;
        case Mode.Taxi: return TransportCategory.Road;
    }
}

interface Step {
    id: string,
    fp: string,
    fc: string,
    tp: string,
    tc: string,
    m: Mode,
    p: number[][],
    z: number,
    c: number,
    x: number,
    d: string
}

const startLngLat: maplibreGl.LngLatLike = [-2.136594, 53.3504035];

const mapOptions: maplibreGl.MapOptions = {
    container: "map",
    style: "https://api.maptiler.com/maps/basic-v2/style.json?key=C72nUT04CqVXILemJsg3",
    center: startLngLat,
    zoom: 6
};


var map: maplibreGl.Map;

var steps: Step[] | undefined;
const lineColour = '#8856a7';
const lineColourHighlighted = '#e31c3d';

var features: Feature<LineString>[] = [];
var featuresBBox: maplibreGl.LngLatBoundsLike;

var startTime: number | undefined;
var previousTimestamp: number;

const modeIcon = document.createElement("img");
modeIcon.width = 32;
modeIcon.height = 32;
modeIcon.classList.add("icon");

const marker = new maplibreGl.Marker({ element: modeIcon });
marker.setLngLat(startLngLat);
var currentModeIcon: string | undefined;

var highlighetedStepId: string | undefined;

var alreadyStarted: boolean = false;

const startMarkers = new Map<string, maplibreGl.Marker>();
const endMarkers = new Map<string, maplibreGl.Marker>();

const stepIdFeature = new Map<string, Feature<LineString>>();

const counts = transportCategoryZeroMap();
const costs = transportCategoryZeroMap();
const times = transportCategoryZeroMap();
const distances = transportCategoryZeroMap();

const countElements = new Map<TransportCategory, HTMLElement>();
const costElements = new Map<TransportCategory, HTMLElement>();
const timeElements = new Map<TransportCategory, HTMLElement>();
const distanceElements = new Map<TransportCategory, HTMLElement>();
const containerElements = new Map<TransportCategory, HTMLElement>();

function transportCategoryZeroMap(): Map<TransportCategory, number> {
    const map = new Map<TransportCategory, number>();
    for (const category of allTransportCategories()) {
        map.set(category, 0);
    }
    return map;
}

const totalAnimationTime = 10000;

const stepStartsAt: number[] =  [];
var totalTripLength = 0;

function iconFor(transportCategory: TransportCategory): string {
    return params.icons[transportCategory.toString()];
}

function lngLatLike(coords: number[]): maplibreGl.LngLatLike {
    return [coords[0], coords[1]];
}

function displayCostsAndCounts() {
    for (const category of allTransportCategories()) {
        const cost = costs.get(category);
        const count = counts.get(category);
        const time = times.get(category);
        const distance = distances.get(category);

        const countElement = countElements.get(category);
        if (countElement) {
            countElement.innerHTML = `${Math.ceil(count)}`;
        }

        const costElement = costElements.get(category);
        if (costElement) {
            costElement.innerHTML = `£${cost.toFixed(2)}`;
        }

        const timeElement = timeElements.get(category);

        if (timeElement) {
            timeElement.innerHTML = minutesToHuman(time);
        }

        const distanceElement = distanceElements.get(category);

        if (distanceElement) {
            distanceElement.innerHTML = `${distance.toLocaleString('en-US', { maximumFractionDigits: 0 })} km`;
        }
    }
}

function calculateBoundingBox(ofFeatures: Feature<LineString>[]): maplibreGl.LngLatBoundsLike {
    var minLng = Number.MAX_VALUE;
    var maxLng = Number.MIN_VALUE;

    var minLat = Number.MAX_VALUE;
    var maxLat = Number.MIN_VALUE;

    for (const feature of ofFeatures) {
        for (const p of feature.geometry.coordinates) {
            minLng = Math.min(p[0], minLng);
            maxLng = Math.max(p[0], maxLng);

            minLat = Math.min(p[1], minLat);
            maxLat = Math.max(p[1], maxLat);
        }
    }

    return [[minLng, minLat], [maxLng, maxLat]];
}

function findLastIndex<T>(array: Array<T>, predicate: (value: T, index: number, obj: T[]) => boolean): number {
    let l = array.length;
    while (l--) {
        if (predicate(array[l], l, array))
            return l;
    }
    return -1;
}

function pointForTime(time: number): [maplibreGl.LngLatLike, number] {
    const elapsed = (time % totalAnimationTime) / totalAnimationTime;
    const currentKm = Math.max(0.00001, Math.min(elapsed * totalTripLength, totalTripLength));
    var stepIndex = findLastIndex(stepStartsAt, (startsAt) => startsAt <= currentKm);
    const feature = features[stepIndex];
    const kmInStep = currentKm - stepStartsAt[stepIndex];
    const currentPoint = turf.along(feature, kmInStep, { 'units': 'kilometers' });
    return [lngLatLike(currentPoint.geometry.coordinates), stepIndex];
}

function animateLine(timestamp: number) {
    if (previousTimestamp == timestamp) {
        requestAnimationFrame(animateLine);
        return;
    }
    if (startTime == undefined) {
        startTime = timestamp;
    }

    if (steps == undefined) {
        console.error("no steps defined");
        return;
    }

    const elapsed = timestamp - startTime;

    const [currentPoint, stepIndex] = pointForTime(elapsed);
    marker.setLngLat(currentPoint);

    const step = steps[stepIndex];
    const category = modeToCategory(step.m);
    if (currentModeIcon != step.m?.toString()) {
        currentModeIcon = step.m?.toString();
        modeIcon.setAttribute("src", iconFor(category));
    }

    requestAnimationFrame(animateLine);
}

function sourceKeyFor(id: string) {
    return `source${id}`;
}

function addMarker(coords: maplibreGl.LngLatLike, popupText: string): maplibreGl.Marker {
    const marker = new maplibreGl.Marker();
    marker.setLngLat(coords).setPopup(new maplibreGl.Popup({ focusAfterOpen: false }).setText(popupText)).addTo(map);
    return marker;
}

function renderSteps(route: Step[]) {
    steps = [];

    map.on('load', function () {

        const from: string = window.mappyTravelsFrom;
        const to: string = window.mappyTravelsTo;

        console.log(`starting for ${from} to ${to}`);

        const isForSubset: boolean = from != "" || to != "";

        var rangeStarted = false;

        var lastStepStartsAt = 0;

        for (let step of route) {
            if (isForSubset && !rangeStarted && step.id != from) {
                continue;
            }
            else {
                rangeStarted = true;
            }

            steps.push(step);

            const feature: Feature<LineString> = {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": step.p
                },
                properties: {}
            }
            features.push(feature);
            stepIdFeature.set(step.id, feature);

            const length = turf.length(feature, { units: 'kilometers' });
            stepStartsAt.push(lastStepStartsAt);
            lastStepStartsAt += length;
            totalTripLength = lastStepStartsAt;

            const category = modeToCategory(step.m);
            const lastCount = counts.get(category);
            const lastCost = costs.get(category);
            const lastTime = times.get(category);
            const lastDistance = distances.get(category);

            if (lastCount != undefined) {
                counts.set(category, lastCount + step.c);
            }
            if (lastCost != undefined) {
                costs.set(category, lastCost + step.x);
            }
            if (lastTime != undefined) {
                times.set(category, lastTime + durationStringToMinutes(step.d));
            }
            if (lastDistance != undefined) {
                distances.set(category, lastDistance + length);
            }

            const sourceKey = sourceKeyFor(step.id);

            const source: maplibreGl.GeoJSONSourceSpecification = {
                type: "geojson",
                data: feature
            };

            map.addSource(sourceKeyFor(step.id), source);
            map.addLayer({
                id: sourceKey,
                type: "line",
                source: sourceKey,
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': lineColour,
                    'line-width': 3
                }
            });

            const start = lngLatLike(feature.geometry.coordinates[0]);
            const end = lngLatLike(feature.geometry.coordinates[feature.geometry.coordinates.length - 1]);
            startMarkers.set(step.id, addMarker(start, `${step.fp} (${step.fc})`));
            endMarkers.set(step.id, addMarker(end, `${step.tp} (${step.tc})`));

            if (isForSubset && step.id == to) {
                break;
            }
        }

        featuresBBox = calculateBoundingBox(features);
        registerRowElementEvents();

        marker.addTo(map);

        map.fitBounds(featuresBBox, {
            animate: false,
            padding: { top: 60, bottom: 60, left: 60, right: 60 }
        });

        displayCostsAndCounts();
        requestAnimationFrame(animateLine);
    });
}

function rowElementMouseDown(id: string): ((MouseEvent) => void) {
    return (ev: MouseEvent) => {
        if (highlighetedStepId) {
            setLayerColour(highlighetedStepId, lineColour);
            const element = document.getElementById(rowElementId(highlighetedStepId));
            if (element) {
                element.classList.remove("row-highlighted");
            }

            const startMarker: maplibreGl.Marker = startMarkers.get(highlighetedStepId);
            if (startMarker) {
                startMarker.togglePopup();
            }

            const endMarker: maplibreGl.Marker = endMarkers.get(highlighetedStepId);
            if (endMarker) {
                endMarker.togglePopup();
            }
        }   
        highlighetedStepId = id;
        setLayerColour(highlighetedStepId, lineColourHighlighted);
        const element = document.getElementById(rowElementId(highlighetedStepId));
        if (element) {
            element.classList.add("row-highlighted");
        }

        const startMarker: maplibreGl.Marker = startMarkers.get(highlighetedStepId);
        if (startMarker) {
            startMarker.togglePopup();
        }

        const endMarker: maplibreGl.Marker = endMarkers.get(highlighetedStepId);
        if (endMarker) {
            endMarker.togglePopup();
        }

        const feature = stepIdFeature.get(id);
        if (feature) {
            const bbox  = calculateBoundingBox([feature]);
            map.fitBounds(bbox, {
                animate: false,
                padding: { top: 60, bottom: 60, left: 60, right: 60 }
            });
        }
    };
}

function setLayerColour(id: string, colour: string) {
    map.setPaintProperty(sourceKeyFor(id), 'line-color', colour);
}

function rowElementId(id: string) {
    return `row-${id}`;
}

function registerRowElementEvents() {
    for (const step of steps) {
        const element = document.getElementById(rowElementId(step.id));

        if (element) {
            element.addEventListener('mousedown', rowElementMouseDown(step.id));
        }
    }
}

function mappyStart() {
    if (alreadyStarted) {
        return;
    }

    alreadyStarted = true;
    map = new maplibreGl.Map(mapOptions);
    map.addControl(new maplibreGl.NavigationControl({ showCompass: true, showZoom: true, visualizePitch: true }));
    map.addControl(new maplibreGl.FullscreenControl({}));

    for (const category of allTransportCategories()) {
        const countElement = document.getElementById(`count-${category}`);
        if (countElement) {
            countElements.set(category, countElement);
        }
        const costElement = document.getElementById(`cost-${category}`);
        if (costElement) {
            costElements.set(category, costElement);
        }
        const timeElement = document.getElementById(`time-${category}`);
        if (timeElement) {
            timeElements.set(category, timeElement);
        }
        const distanceElement = document.getElementById(`distance-${category}`);
        if (distanceElement) {
            distanceElements.set(category, distanceElement);
        }
        const containerElement = document.getElementById(`container-${category}`);
        if (containerElement) {
            containerElements.set(category, containerElement);
        }
    }
    fetch(routeRequest)
        .then((response) => {
            if (response.ok) {
                response
                    .json()
                    .catch((e) => console.log(`successful route request, but was not json ${e}`))
                    .then((data) => renderSteps(data as Step[]));
            }
            else {
                console.log(`route request gave response code ${response.status}`);
            }
        });
}
window.mappyStart = mappyStart;

document.addEventListener("DOMContentLoaded", () => {
    if (window.mappyAutoStart == "yes") {
        mappyStart();
    }
});
