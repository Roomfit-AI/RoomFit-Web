import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import RecommendationGenerationPanel from "../components/recommendation/RecommendationGenerationPanel";
import { prepareAdditionalFurnitureForEditor } from "../config/layoutEditingWorkflow";
import {
  createRecommendationGenerationController,
  getRecommendationGenerationErrorMessage,
  readRecommendationPreparation,
  type RecommendationGenerationController,
} from "../config/recommendationGeneration";

export default function Recommendation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [preparation] = useState(readRecommendationPreparation);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState(preparation.message);
  const controllerRef = useRef<RecommendationGenerationController | null>(null);

  if (controllerRef.current == null) {
    controllerRef.current = createRecommendationGenerationController({
      generate: prepareAdditionalFurnitureForEditor,
      navigate,
      onRunningChange: setIsGenerating,
      onFailure: (error) => setErrorMessage(
        error ? getRecommendationGenerationErrorMessage(error) : "",
      ),
    });
  }

  return (
    <main className="grid min-h-[calc(100vh-76px)] place-items-center bg-[#fbfbfb] px-5 py-10 text-[#141414] sm:px-8">
      <RecommendationGenerationPanel
        roomTitle={preparation.roomTitle}
        selectedFurnitureCount={preparation.selectedFurnitureCount}
        isGenerating={isGenerating}
        errorMessage={errorMessage}
        ready={preparation.ready}
        onGenerate={() => { void controllerRef.current?.run(); }}
        onPrevious={() => navigate("/add-furniture", { state: location.state })}
      />
    </main>
  );
}
