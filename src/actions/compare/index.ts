export {
  createCompareExecutor,
  type CompareExecutorDeps,
  EmptyAlternativesProvider,
  LocalPageAlternativesProvider,
  PageLinkAlternativesProvider,
  StaticAlternativesProvider,
  collectPageLinkCandidates,
  pickHeuristicLinks,
  scoreLinkCandidate,
  type AlternativesProvider,
  type AlternativesFindResult,
} from './executor';
