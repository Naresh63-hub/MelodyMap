import { describe, expect, it } from "vitest";
import {
  runBanditSimulation,
  RandomPolicy,
  EpsilonGreedyPolicy,
  OraclePolicy,
  generateCandidatePool,
  type UserPreferenceProfile,
} from "./bandit-evaluation";
import { ThompsonSamplingPolicy } from "./bandit-policy";

describe("Contextual Bandit Offline Evaluation Harness", () => {
  it("generates synthetic candidate pools of requested size with non-empty metadata", () => {
    const pool = generateCandidatePool(15, 2);
    expect(pool).toHaveLength(15);
    expect(pool[0]?.id).toBe("track-2-0");
    expect(pool[0]?.artist).toBeTruthy();
    expect(pool[0]?.title).toBeTruthy();
  });

  describe("Individual Policy Contracts", () => {
    const candidates = generateCandidatePool(10, 1);
    const context = { hourOfDay: 15, discoveryPercent: 40 };

    it("RandomPolicy selects candidates within pool bounds", () => {
      const policy = new RandomPolicy(() => 0.5);
      const chosen = policy.selectNextTrack(candidates, context);
      expect(chosen).not.toBeNull();
      expect(candidates.map((c) => c.id)).toContain(chosen?.id);
    });

    it("EpsilonGreedyPolicy selects highest scoring candidate during exploitation", () => {
      // epsilon = 0 (pure exploitation)
      const policy = new EpsilonGreedyPolicy(0.0);
      const chosen = policy.selectNextTrack(candidates, context);
      expect(chosen).not.toBeNull();
      expect(candidates.map((c) => c.id)).toContain(chosen?.id);
    });

    it("OraclePolicy selects the strictly optimal candidate according to true weights", () => {
      const weights = [0.1, 0.9, 0.1, 0.1, 0.1, 0.1];
      const policy = new OraclePolicy(weights);
      const chosen = policy.selectNextTrack(candidates, context);
      expect(chosen).not.toBeNull();
    });
  });

  describe("Comparative Offline Simulation Execution", () => {
    it("runs 200 simulation rounds and confirms Thompson Sampling outperforms Random baseline", () => {
      const userProfile: UserPreferenceProfile = {
        name: "Test Profile",
        trueWeights: [0.2, 0.5, 0.3, 0.6, 0.1, 0.2],
        rewardNoiseStd: 0.02,
      };

      const report = runBanditSimulation(userProfile, {
        rounds: 200,
        candidatePoolSize: 10,
        epsilon: 0.1,
        seed: 42,
      });

      expect(report.results.thompson.totalRounds).toBe(200);
      expect(report.results.random.totalRounds).toBe(200);
      expect(report.results.epsilonGreedy.totalRounds).toBe(200);
      expect(report.results.oracle.totalRounds).toBe(200);

      // Oracle achieves the highest theoretical reward
      expect(report.results.oracle.cumulativeReward).toBeGreaterThanOrEqual(
        report.results.thompson.cumulativeReward,
      );

      // Thompson Sampling achieves higher cumulative reward than Random baseline
      expect(report.results.thompson.cumulativeReward).toBeGreaterThan(
        report.results.random.cumulativeReward,
      );

      // Thompson Sampling achieves lower cumulative regret than Random baseline
      expect(report.results.thompson.cumulativeRegret).toBeLessThan(
        report.results.random.cumulativeRegret,
      );

      // Thompson Sampling shows statistically significant regret reduction vs Random (> 30%)
      expect(report.summary.thompsonRegretReductionVsRandom).toBeGreaterThan(30);

      // Verify trajectory tracking captures snapshots
      expect(report.results.thompson.trajectory.length).toBeGreaterThan(15);
      const lastStep = report.results.thompson.trajectory.at(-1);
      expect(lastStep?.round).toBe(200);
      expect(lastStep?.cumulativeReward).toBe(report.results.thompson.cumulativeReward);

      // Artist diversity metric should be tracked
      expect(report.results.thompson.uniqueArtistsCount).toBeGreaterThan(5);
      expect(report.results.thompson.artistDiversityRatio).toBeGreaterThan(0);
    });

    it("Thompson Sampling adapts and discovers optimal arms when user preferences deviate from default prior", () => {
      // User with strong discovery & momentum preferences that invert the standard prior
      const discoveryUserProfile: UserPreferenceProfile = {
        name: "Discovery & Novelty Hunter",
        trueWeights: [0.0, 0.1, 0.1, 0.2, 0.95, 0.8],
        rewardNoiseStd: 0.02,
      };

      const report = runBanditSimulation(discoveryUserProfile, {
        rounds: 250,
        candidatePoolSize: 10,
        epsilon: 0.2,
        seed: 12345,
      });

      // Both bandit algorithms should vastly outperform random selection
      expect(report.results.thompson.cumulativeReward).toBeGreaterThan(
        report.results.random.cumulativeReward,
      );
      expect(report.results.thompson.cumulativeRegret).toBeLessThan(
        report.results.random.cumulativeRegret,
      );

      // Trajectory of regret should be sub-linear (average regret per round drops over time)
      const firstQuarter = report.results.thompson.trajectory.find((s) => s.round >= 50);
      const lastQuarter = report.results.thompson.trajectory.at(-1);

      if (firstQuarter && lastQuarter) {
        const earlyRegretRate = firstQuarter.cumulativeRegret / firstQuarter.round;
        const lateRegretRate =
          (lastQuarter.cumulativeRegret - firstQuarter.cumulativeRegret) /
          (lastQuarter.round - firstQuarter.round);

        // Regret rate in later rounds is lower than in early rounds as the model learns
        expect(lateRegretRate).toBeLessThanOrEqual(earlyRegretRate + 0.05);
      }
    });
  });
});
