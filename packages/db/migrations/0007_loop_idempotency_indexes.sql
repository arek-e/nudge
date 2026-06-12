DROP INDEX IF EXISTS `reviews_proposal_idx`;
DELETE FROM `reviews`
WHERE rowid NOT IN (
  SELECT MIN(rowid)
  FROM `reviews`
  GROUP BY `proposal_id`
);
CREATE UNIQUE INDEX `reviews_proposal_idx` ON `reviews` (`proposal_id`);

DROP INDEX IF EXISTS `commitments_proposal_idx`;
DELETE FROM `commitments`
WHERE rowid NOT IN (
  SELECT MIN(rowid)
  FROM `commitments`
  GROUP BY `proposal_id`
);
CREATE UNIQUE INDEX `commitments_proposal_idx` ON `commitments` (`proposal_id`);

DROP INDEX IF EXISTS `commitments_review_idx`;
DELETE FROM `commitments`
WHERE rowid NOT IN (
  SELECT MIN(rowid)
  FROM `commitments`
  GROUP BY `review_id`
);
CREATE UNIQUE INDEX `commitments_review_idx` ON `commitments` (`review_id`);

DROP INDEX IF EXISTS `outcomes_commitment_idx`;
DELETE FROM `outcomes`
WHERE rowid NOT IN (
  SELECT MIN(rowid)
  FROM `outcomes`
  GROUP BY `commitment_id`
);
CREATE UNIQUE INDEX `outcomes_commitment_idx` ON `outcomes` (`commitment_id`);
