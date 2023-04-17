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
    fromPlace: string,
    fromCountry: string,
    toPlace: string,
    toCountry: string,
    fromLatlng: string,
    toLatlng: string
    mode: Mode,
    geojson: string,
    zoomLevel: number,
    animationSpeed: number,
    contribution: number,
    cost: number,
    duration: string
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

const initialSource: maplibreGl.GeoJSONSourceSpecification = {
    type: "geojson",
    data: {
        type: "Feature",
        properties: {},
        geometry: {
            type: "LineString",
            coordinates: []
        }
    }
};

var startTime: number | undefined;
var previousTimestamp: number;

var currentFeature = 0;

const modeIcon = document.createElement("img");
modeIcon.width = 32;
modeIcon.height = 32;
modeIcon.classList.add("icon");

const marker = new maplibreGl.Marker({ element: modeIcon });
marker.setLngLat(startLngLat);
var currentModeIcon: string | undefined;

var highlighetedStepId: string | undefined;

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

const inProgressCounts = transportCategoryZeroMap();
const inProgressCosts = transportCategoryZeroMap();
const inProgressTimes = transportCategoryZeroMap();
const inProgressDistances = transportCategoryZeroMap();

function transportCategoryZeroMap(): Map<TransportCategory, number> {
    const map = new Map<TransportCategory, number>();
    for (const category of allTransportCategories()) {
        map.set(category, 0);
    }
    return map;
}

const animationSpeeds = new Map<TransportCategory, number>();
animationSpeeds.set(TransportCategory.Air, 1500);
animationSpeeds.set(TransportCategory.Rail, 200);
animationSpeeds.set(TransportCategory.Road, 200);
animationSpeeds.set(TransportCategory.Sea, 100);

const zooms = new Map<TransportCategory, number>();
zooms.set(TransportCategory.Air, 3);
zooms.set(TransportCategory.Road, 6);
zooms.set(TransportCategory.Rail, 6);
zooms.set(TransportCategory.Sea, 6);

function iconFor(transportCategory: TransportCategory): string {
    return params.icons[transportCategory.toString()];
}

function lngLatLike(coords: number[]): maplibreGl.LngLatLike {
    return [coords[0], coords[1]];
}

function toggleMarker(i: number, markers: Map<string, maplibreGl.Marker>) {
    const prevStep = steps[i - 1];
    if (prevStep) {
        const prevId = prevStep.id;
        const prevMarker = markers.get(prevId);

        if (prevMarker) {
            prevMarker.togglePopup();
        }
    }

    const step = steps[i];
    if (step) {
        const id = step.id;
        const marker = markers.get(id);

        if (marker) {
            marker.togglePopup();
        }
    }
}

function total(currentMap: Map<TransportCategory, number>, inProgressMap: Map<TransportCategory, number>, transportCategory: TransportCategory): number {
    var result = 0;

    const current = currentMap.get(transportCategory);
    if (current) {
        result += current;
    }

    const inProgress = inProgressMap.get(transportCategory);
    if (inProgress) {
        result += inProgress;
    }

    return result;
}

function displayCostsAndCounts() {
    for (const category of allTransportCategories()) {
        const cost = total(costs, inProgressCosts, category);
        const count = total(counts, inProgressCounts, category);
        const time = total(times, inProgressTimes, category);
        const distance = total(distances, inProgressDistances, category);

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

function animateStep(timestamp: number, i: number) {
    startTime = undefined;

    const feature = features[i];
    const start = feature.geometry.coordinates[0];
    // map.panTo(lngLatLike(start), { animate: false });

    if (steps) {
        if (i > 0) {
            const lastStep = steps[i - 1];
            const lastCategory = modeToCategory(lastStep.mode);
            const lastCount = counts.get(lastCategory);
            const lastCost = costs.get(lastCategory);
            const lastTime = times.get(lastCategory);
            const lastDistance = distances.get(lastCategory);

            if (lastCount != undefined) {
                counts.set(lastCategory, lastCount + lastStep.contribution);
            }
            if (lastCost != undefined) {
                costs.set(lastCategory, lastCost + lastStep.cost);
            }
            if (lastTime != undefined) {
                times.set(lastCategory, lastTime + durationStringToMinutes(lastStep.duration));
            }
            const lastFeature = features[i - 1];
            if (lastFeature && lastDistance != undefined) {
                distances.set(lastCategory, lastDistance + turf.lineDistance(lastFeature, { units: "kilometers" }));
            }

            inProgressCosts.set(lastCategory, 0);
            inProgressCounts.set(lastCategory, 0);
            inProgressTimes.set(lastCategory, 0);
            inProgressDistances.set(lastCategory, 0);
        }

        const step = steps[i];
        const stepCategory = modeToCategory(step.mode);

        if (step) {
            map.zoomTo(step.zoomLevel, { animate: false });
        }

        for (const category of allTransportCategories()) {
            const containerElement = containerElements.get(category);
            if (containerElement) {
                const isActive = category == stepCategory;

                if (isActive) {
                    containerElement.classList.add("activeContainer");
                }
                else {
                    containerElement.classList.remove("activeContainer");
                }
            }
        }
    }

    toggleMarker(i, startMarkers);
    toggleMarker(i, endMarkers);

    displayCostsAndCounts();
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

function animationsFinished() {
    for (const category of allTransportCategories()) {
        const containerElement = containerElements.get(category);
        if (containerElement) {
            containerElement.classList.remove("activeContainer");
        }
    }
    toggleMarker(steps.length, startMarkers);
    toggleMarker(steps.length, endMarkers);
    marker.remove();
    map.fitBounds(featuresBBox, {
        animate: false,
        padding: { top: 60, bottom: 60, left: 60, right: 60 }
    });
}

function timeFor(category: TransportCategory, distance: number): number {
    const kms = animationSpeeds.get(category);

    if (kms != undefined) {
        return distance / kms * 1000;
    }
    else {
        throw "woah!";
    }
}

function zoomFor(category: TransportCategory): number {
    return zooms.get(category) ?? 1;
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

    const step = steps[currentFeature];
    const category = modeToCategory(step.mode);
    if (currentModeIcon != step.mode?.toString()) {
        currentModeIcon = step.mode?.toString();
        modeIcon.setAttribute("src", iconFor(category));
    }

    const feature = features[currentFeature];
    const sourceKey = sourceKeyFor(step.id);
    const maxKm = turf.length(feature, { units: 'kilometers' });

    const progress = elapsed / timeFor(category, maxKm);
    const currentKm = Math.max(0.0001, Math.min(progress * maxKm, maxKm));

    if (currentKm < maxKm) {
        inProgressCounts.set(category, step.contribution * progress);
        inProgressCosts.set(category, step.cost * progress);
        inProgressTimes.set(category, durationStringToMinutes(step.duration) * progress);
        inProgressDistances.set(category, currentKm);

        const currentPoint = turf.along(feature, currentKm, { 'units': 'kilometers' });
        const lineString = turf.lineSlice(feature.geometry.coordinates[0], currentPoint, feature);
        const mapSource = map.getSource(sourceKey) as GeoJSONSource;

        if (mapSource) {
            mapSource.setData(lineString);
            map.panTo(lngLatLike(currentPoint.geometry.coordinates), { animate: false });
            marker.setLngLat(lngLatLike(currentPoint.geometry.coordinates));
        }

        displayCostsAndCounts();

        requestAnimationFrame(animateLine);
    }
    else {
        const mapSource = map.getSource(sourceKey) as GeoJSONSource;

        if (mapSource) {
            mapSource.setData(feature.geometry);
            const end = lngLatLike(feature.geometry.coordinates[feature.geometry.coordinates.length - 1]);
            map.panTo(end, { animate: false });
            marker.setLngLat(end);
        }

        if (++currentFeature < features.length) {
            animateStep(timestamp, currentFeature);
            requestAnimationFrame(animateLine);
        } else {
            animationsFinished();
        }
    }
}

function sourceKeyFor(id: string) {
    return `source${id}`;
}

function addMarker(coords: maplibreGl.LngLatLike, popupText: string): maplibreGl.Marker {
    const marker = new maplibreGl.Marker();
    marker.setLngLat(coords).setPopup(new maplibreGl.Popup().setText(popupText)).addTo(map);
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

        for (let step of route) {
            if (isForSubset && !rangeStarted && step.id != from) {
                continue;
            }
            else {
                rangeStarted = true;
            }

            steps.push(step);

            const featureCollection: FeatureCollection<LineString> = JSON.parse(step.geojson);
            const feature = featureCollection.features[0];
            features.push(feature);
            stepIdFeature.set(step.id, feature);

            const sourceKey = sourceKeyFor(step.id);
            map.addSource(sourceKeyFor(step.id), initialSource);
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
            startMarkers.set(step.id, addMarker(start, `${step.fromPlace} (${step.fromCountry})`));
            endMarkers.set(step.id, addMarker(end, `${step.toPlace} (${step.toCountry})`));

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
        animateStep(performance.now(), 0);
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

document.addEventListener("DOMContentLoaded", () => {
    map = new maplibreGl.Map(mapOptions);
    map.addControl(new maplibreGl.NavigationControl({ showCompass: true, showZoom: true, visualizePitch: true }));


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
});
