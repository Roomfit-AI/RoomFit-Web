import {
  getRecentUploadedRooms,
  getSampleRooms,
  type SampleRoomCard,
  type UploadedRoomCard,
} from "../api/rooms";

interface RoomsPageApi {
  getSamples(): Promise<SampleRoomCard[]>;
  getRecent(clientId: string): Promise<UploadedRoomCard[]>;
}

export interface RoomsPageLoader {
  loadSamples(): Promise<SampleRoomCard[]>;
  loadRecent(clientId: string | null): Promise<UploadedRoomCard[]>;
}

export function createRoomsPageLoader(api: RoomsPageApi): RoomsPageLoader {
  let samplesInFlight: Promise<SampleRoomCard[]> | null = null;
  const recentInFlight = new Map<string, Promise<UploadedRoomCard[]>>();

  return {
    loadSamples() {
      if (!samplesInFlight) {
        const request = api.getSamples();
        samplesInFlight = request;
        void request.then(
          () => { if (samplesInFlight === request) samplesInFlight = null; },
          () => { if (samplesInFlight === request) samplesInFlight = null; },
        );
      }
      return samplesInFlight;
    },
    loadRecent(clientId) {
      if (!clientId) return Promise.resolve([]);
      const existing = recentInFlight.get(clientId);
      if (existing) return existing;

      const request = api.getRecent(clientId);
      recentInFlight.set(clientId, request);
      void request.then(
        () => { if (recentInFlight.get(clientId) === request) recentInFlight.delete(clientId); },
        () => { if (recentInFlight.get(clientId) === request) recentInFlight.delete(clientId); },
      );
      return request;
    },
  };
}

export const roomsPageLoader = createRoomsPageLoader({
  getSamples: getSampleRooms,
  getRecent: (clientId) => getRecentUploadedRooms(10, clientId),
});
