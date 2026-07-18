import {
  getRecentUploadedRooms,
  getSampleRooms,
  type SampleRoomCard,
  type UploadedRoomCard,
} from "../api/rooms";

interface RoomsPageApi {
  getSamples(): Promise<SampleRoomCard[]>;
  getRecent(): Promise<UploadedRoomCard[]>;
}

export interface RoomsPageLoader {
  loadSamples(): Promise<SampleRoomCard[]>;
  loadRecent(): Promise<UploadedRoomCard[]>;
}

export function createRoomsPageLoader(api: RoomsPageApi): RoomsPageLoader {
  let samplesInFlight: Promise<SampleRoomCard[]> | null = null;
  let recentInFlight: Promise<UploadedRoomCard[]> | null = null;

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
    loadRecent() {
      if (!recentInFlight) {
        const request = api.getRecent();
        recentInFlight = request;
        void request.then(
          () => { if (recentInFlight === request) recentInFlight = null; },
          () => { if (recentInFlight === request) recentInFlight = null; },
        );
      }
      return recentInFlight;
    },
  };
}

export const roomsPageLoader = createRoomsPageLoader({
  getSamples: getSampleRooms,
  getRecent: getRecentUploadedRooms,
});
