export function durationStringToMinutes(str: string): number {
    const parts = str.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    return (hours * 60) + minutes;
}

function plural(n: number) {
    return n == 1 ? "" : "s";
}

export function minutesToHuman(minutes: number): string {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    return `${days} day${plural(days)} ${hours} hour${plural(hours)}`;
}