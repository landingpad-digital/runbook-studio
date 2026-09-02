import type { Runbook } from "./types";

/**
 * Three generic example runbooks. The first loads by default. None of them
 * contain real client data, internal detail, credentials or infrastructure
 * specifics. Step ids are stable so branches can point at them.
 */

export const crmOnboarding: Runbook = {
  id: "rb_crm_onboarding",
  title: "Onboarding a new client into the CRM",
  description:
    "The steps an account manager follows when a signed client is handed over from sales. " +
    "Written when the CRM was first set up, so parts of it may no longer match the current screens.",
  steps: [
    {
      id: "crm_1",
      order: 1,
      title: "Collect the handover pack from sales",
      instruction:
        "Ask the salesperson for the signed proposal, the primary contact details and the agreed start date.",
      check: "All three items are present and the start date is in the future.",
    },
    {
      id: "crm_2",
      order: 2,
      title: "Search the CRM for an existing record",
      instruction:
        "Search by company name and by the primary contact's email address before creating anything.",
      branch: {
        condition: "A matching company record already exists",
        targetStepId: "crm_4",
      },
    },
    {
      id: "crm_3",
      order: 3,
      title: "Create the company record",
      instruction:
        "Create a new company record. Enter the legal name, trading name, billing address and industry.",
      check: "The new company record saves without validation errors.",
    },
    {
      id: "crm_4",
      order: 4,
      title: "Add the primary contact",
      instruction:
        "Open the company record, add the primary contact and mark them as the decision maker.",
    },
    {
      id: "crm_5",
      order: 5,
      title: "Set the account stage using the Pipeline tab",
      instruction:
        "Open the Pipeline tab on the company record and set the stage to Won. Then tick the box labelled Send welcome pack.",
      check: "The stage reads Won and the welcome pack email appears in the activity log within five minutes.",
    },
    {
      id: "crm_6",
      order: 6,
      title: "Create the onboarding project",
      instruction:
        "From the company record, create a project named after the client with the agreed start date. Use the standard onboarding template.",
    },
    {
      id: "crm_7",
      order: 7,
      title: "Book the kick-off call",
      instruction:
        "Send a calendar invitation for a 30 minute kick-off call to the primary contact and the account manager within the first week.",
      check: "The invitation has been accepted by the primary contact.",
    },
    {
      id: "crm_8",
      order: 8,
      title: "Hand the account to the delivery lead",
      instruction:
        "Assign the company record and the project to the delivery lead and post a short handover note on the record.",
    },
  ],
};

export const databaseRestore: Runbook = {
  id: "rb_database_restore",
  title: "Restoring a database from a backup",
  description:
    "A cautious procedure for restoring a production database from the most recent verified backup. " +
    "The checks exist because a wrong step here loses data.",
  steps: [
    {
      id: "db_1",
      order: 1,
      title: "Confirm the restore is actually needed",
      instruction:
        "Establish what data is missing or corrupt and when it was last known good. Record this in the incident log before touching anything.",
      check: "The incident log states the target restore point and who approved the restore.",
    },
    {
      id: "db_2",
      order: 2,
      title: "Put the application into maintenance mode",
      instruction:
        "Enable maintenance mode so no new writes reach the database during the restore.",
      check: "A test request returns the maintenance page and the write queue is empty.",
    },
    {
      id: "db_3",
      order: 3,
      title: "Take a fresh snapshot of the current state",
      instruction:
        "Even if the current data is damaged, snapshot it first so nothing is lost if the restore goes wrong.",
      check: "The snapshot completes and its size is within the expected range.",
    },
    {
      id: "db_4",
      order: 4,
      title: "Locate and verify the backup",
      instruction:
        "Find the backup matching the target restore point and verify its checksum against the backup catalogue.",
      check: "The checksum matches.",
      branch: {
        condition: "The checksum does not match or the backup is missing",
        targetStepId: "db_8",
      },
    },
    {
      id: "db_5",
      order: 5,
      title: "Restore into a staging database first",
      instruction:
        "Restore the backup into an empty staging database and run the integrity checks there.",
      check: "Integrity checks pass and row counts for the key tables look plausible.",
    },
    {
      id: "db_6",
      order: 6,
      title: "Promote the restored data to production",
      instruction:
        "Swap the restored database into place using the documented promotion method, not by copying files by hand.",
      check: "The application connects and a read-only smoke test returns expected records.",
    },
    {
      id: "db_7",
      order: 7,
      title: "Leave maintenance mode and monitor",
      instruction:
        "Disable maintenance mode, watch error rates for fifteen minutes and update the incident log with the outcome.",
    },
    {
      id: "db_8",
      order: 8,
      title: "Escalate a failed backup",
      instruction:
        "Do not proceed. Try the previous backup in the catalogue and inform the incident lead that the restore point has moved.",
    },
  ],
};

export const cookingRecipe: Runbook = {
  id: "rb_cooking_recipe",
  title: "Tomato and basil pasta",
  description: "A short recipe, included to show that the step model is not tied to any one field of work.",
  steps: [
    {
      id: "rc_1",
      order: 1,
      title: "Boil the pasta",
      instruction: "Bring a large pan of salted water to the boil and cook 200 g of pasta until just tender.",
      check: "A piece of pasta is soft with a slight bite in the centre.",
    },
    {
      id: "rc_2",
      order: 2,
      title: "Check the basil",
      instruction: "Take a handful of fresh basil leaves and tear them roughly.",
      branch: {
        condition: "There is no fresh basil",
        targetStepId: "rc_5",
      },
    },
    {
      id: "rc_3",
      order: 3,
      title: "Make the sauce",
      instruction: "Warm olive oil with a crushed garlic clove, add a tin of chopped tomatoes and simmer for ten minutes.",
    },
    {
      id: "rc_4",
      order: 4,
      title: "Combine and serve",
      instruction: "Toss the drained pasta through the sauce with the basil and serve with grated cheese.",
    },
    {
      id: "rc_5",
      order: 5,
      title: "Substitute dried herbs",
      instruction: "Use a teaspoon of dried oregano in the sauce instead of basil, then return to making the sauce.",
      branch: {
        condition: "Always, after the substitution",
        targetStepId: "rc_3",
      },
    },
  ],
};

export const seedRunbooks: Runbook[] = [crmOnboarding, databaseRestore, cookingRecipe];
