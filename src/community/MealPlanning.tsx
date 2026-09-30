import { formValues } from './forms';
import { useState } from 'react';
import { useCommunity } from './CommunityContext';
import { Field } from './ChurchPage';
import { Badge } from '../components';
import type { Dish, Gathering } from './models';
import { commonFoods, conflicts, suggestPairings } from './mealSuggestions';
export function DietaryPreferences() {
  const c = useCommunity();
  const [kind, setKind] = useState<'allergy' | 'sensitivity'>('allergy');
  const needs = c.data.dietary.filter((n) => n.group_id === c.group?.id);
  return (
    <div className="dietary-grid">
      <section className="panel form-stack">
        <h2>Food allergies & sensitivities</h2>
        <p>
          Members and guests can declare their own needs, or a household guest’s
          needs with their permission. Use a first name or “my guest”; avoid
          children’s full names.
        </p>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const values = formValues(form);
            const foods = [
              ...new FormData(form).getAll('foods').map(String),
              ...values.other
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            ];
            if (!foods.length) {
              c.setError('Choose a food or enter a specific ingredient.');
              return;
            }
            if (
              await c.save(
                'dietary',
                {
                  id: crypto.randomUUID(),
                  group_id: c.group!.id,
                  user_id: c.userId,
                  person: values.person,
                  kind,
                  foods,
                  notes: values.notes,
                  consent: values.consent === 'on',
                },
                true,
              )
            )
              form.reset();
          }}
        >
          <Field name="person" label="Who is this for?" required />
          <label>
            Requirement type
            <select
              value={kind}
              onChange={(e) =>
                setKind(e.target.value as 'allergy' | 'sensitivity')
              }
            >
              <option value="allergy">Food allergy</option>
              <option value="sensitivity">
                Food sensitivity / intolerance
              </option>
            </select>
          </label>
          <fieldset>
            <legend>Foods to flag</legend>
            <div className="dietary-checks">
              {commonFoods.map((food) => (
                <label className="check" key={food}>
                  <input type="checkbox" name="foods" value={food} />
                  {food}
                </label>
              ))}
            </div>
          </fieldset>
          <Field
            name="other"
            label="Other foods or ingredients (comma separated)"
          />
          <Field
            name="notes"
            label="Preparation / cross-contact notes"
            type="textarea"
          />
          <label className="check">
            <input name="consent" type="checkbox" required />I have permission
            to share these requirements with this group’s members and meal
            planners.
          </label>
          <button className="button primary" disabled={c.busy}>
            Save food requirement
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>Requirements to consider</h2>
        <p>
          Includes all declared needs in this group, including households that
          have not yet responded.
        </p>
        {needs.length ? (
          needs.map((n) => (
            <article className="dietary-card" key={n.id}>
              <Badge>{n.kind}</Badge>
              <h3>{n.person}</h3>
              <p>{n.foods.join(', ')}</p>
              <p className="preserve">{n.notes}</p>
              {n.user_id === c.userId && (
                <button
                  className="text-button"
                  disabled={c.busy}
                  onClick={() => void c.removeDietary(n.id)}
                >
                  Remove my declaration
                </button>
              )}
            </article>
          ))
        ) : (
          <p>
            No requirements declared. This does not mean there are no allergies
            or sensitivities.
          </p>
        )}
        <div className="food-note">
          Always verify the actual ingredients, package labels, and preparation
          with the person bringing the food. Cross-contact is not detected by
          this tool.{' '}
          <a
            href="https://www.fda.gov/consumers/consumer-updates/have-food-allergies-read-label"
            target="_blank"
            rel="noreferrer"
          >
            FDA ingredient-label guidance ↗
          </a>
        </div>
      </section>
    </div>
  );
}
export function MenuSuggestions({ meeting }: { meeting: Gathering }) {
  const c = useCommunity();
  const [main, setMain] = useState(meeting.meal_theme);
  const needs = c.data.dietary.filter((n) => n.group_id === c.group?.id);
  const suggestions = suggestPairings(meeting.meal_theme);
  const existing = c.data.dishes.filter((d) => d.meeting_id === meeting.id);
  return (
    <div className="menu-suggestions">
      <h3>Start with the main dish.</h3>
      {c.isLeader ? (
        <form
          className="dish-form"
          onSubmit={(e) => {
            e.preventDefault();
            void c.save('meetings', { ...meeting, meal_theme: main.trim() });
          }}
        >
          <label>
            Main dish
            <input
              required
              value={main}
              onChange={(e) => setMain(e.target.value)}
              placeholder="e.g. tacos, brisket, lasagna"
              maxLength={160}
            />
          </label>
          <button className="button primary" disabled={c.busy || !main.trim()}>
            Set main dish
          </button>
        </form>
      ) : (
        <p>Main dish: {meeting.meal_theme || 'Not set yet'}</p>
      )}
      {meeting.meal_theme && (
        <div className="food-note">
          <strong>Main dish requires ingredient review.</strong> The title alone
          cannot establish allergens or sensitivities. Add a main-dish slot and
          record the recipe ingredients below.
        </div>
      )}
      {meeting.meal_theme &&
        c.isLeader &&
        !existing.some((d) => d.category === 'main') && (
          <button
            className="button secondary"
            onClick={() =>
              void c.save(
                'dishes',
                {
                  id: crypto.randomUUID(),
                  meeting_id: meeting.id,
                  name: meeting.meal_theme,
                  details: 'Main dish — add ingredients before serving.',
                  assignee_id: null,
                  category: 'main',
                  allergens: [],
                  ingredients: '',
                  ingredient_status: 'unverified',
                },
                true,
              )
            }
            disabled={c.busy}
          >
            Add main-dish sign-up slot
          </button>
        )}
      {suggestions.length > 0 && (
        <>
          <p>Suggested pairings · editable ideas, not verified recipes.</p>
          {suggestions.map((s) => {
            const flags = conflicts(s, needs);
            const exists = existing.some((d) => d.name === s.name);
            return (
              <div className="suggestion-row" key={s.name}>
                <div>
                  <strong>{s.name}</strong> <Badge>{s.category}</Badge>
                  <p>{s.details}</p>
                  {flags.length > 0 ? (
                    <p className="dish-warning">
                      Potential conflict: {flags.join(', ')}
                    </p>
                  ) : (
                    <small>
                      No listed ingredient match; verify the recipe and
                      preparation.
                    </small>
                  )}
                </div>
                {c.isLeader && (
                  <button
                    disabled={c.busy || exists}
                    className="button secondary"
                    onClick={() =>
                      void c.save(
                        'dishes',
                        {
                          ...s,
                          id: crypto.randomUUID(),
                          meeting_id: meeting.id,
                          assignee_id: null,
                          ingredients: '',
                          ingredient_status: 'unverified',
                        },
                        true,
                      )
                    }
                  >
                    {exists ? 'Added' : 'Add to menu'}
                  </button>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
export function DishIngredients({ dish }: { dish: Dish }) {
  const c = useCommunity();
  const [editing, setEditing] = useState(false);
  const needs = c.data.dietary.filter((n) => n.group_id === c.group?.id);
  const flags = conflicts(dish, needs);
  return (
    <>
      <span className="ingredient-status">
        {dish.ingredient_status === 'provided'
          ? 'Ingredient information supplied — confirm with cook'
          : 'Ingredients unverified — review required'}
      </span>
      {flags.length > 0 && (
        <p className="dish-warning">Potential conflict: {flags.join(', ')}</p>
      )}
      {dish.ingredients && <p>{dish.ingredients}</p>}
      {(dish.allergens ?? []).length > 0 && (
        <div>
          {dish.allergens!.map((a) => (
            <span className="food-tag" key={a}>
              {a}
            </span>
          ))}
        </div>
      )}
      {(c.isLeader || dish.assignee_id === c.userId) && (
        <button className="text-button" onClick={() => setEditing(!editing)}>
          {editing ? 'Close ingredients' : 'Edit ingredients / allergen tags'}
        </button>
      )}
      {editing && (
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = formValues(e.currentTarget);
            if (
              await c.save('dishes', {
                ...dish,
                ingredients: f.ingredients,
                allergens: f.allergens
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
                ingredient_status:
                  f.reviewed === 'on' ? 'provided' : 'unverified',
              })
            )
              setEditing(false);
          }}
        >
          <Field
            name="ingredients"
            label="Ingredients and preparation notes"
            type="textarea"
            value={dish.ingredients}
          />
          <Field
            name="allergens"
            label="Allergen / sensitivity tags (comma separated)"
            value={dish.allergens?.join(', ')}
          />
          <label className="check">
            <input
              name="reviewed"
              type="checkbox"
              defaultChecked={dish.ingredient_status === 'provided'}
            />
            I supplied ingredient details for this dish.
          </label>
          <button className="button secondary" disabled={c.busy}>
            Save ingredients
          </button>
        </form>
      )}
    </>
  );
}
