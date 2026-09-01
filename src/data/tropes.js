// Pool of horror-movie tropes used to build bingo boards, tagged by sub-genre.
// Every trope tagged "general" is always eligible regardless of which
// sub-genre the host picks; sub-genre-specific tropes are only added on top
// of the general pool when that sub-genre is selected.
export const SUBGENRES = [
  { id: 'general', label: 'Classic / Mixed Horror' },
  { id: 'slasher', label: 'Slasher' },
  { id: 'supernatural', label: 'Supernatural / Haunted House' },
  { id: 'zombie', label: 'Zombie / Outbreak' },
  { id: 'found-footage', label: 'Found Footage' },
  { id: 'psychological', label: 'Psychological' },
  { id: 'creature', label: 'Creature Feature / Monster' },
];

const DEFAULT_SUBGENRE = 'general';

export const TROPES = [
  // ---------- General (eligible in every sub-genre) ----------
  { text: 'Jump Scare', genres: ['general'] },
  { text: "Character says \"I'll be right back\" and dies", genres: ['general'] },
  { text: 'Power goes out at the worst possible moment', genres: ['general'] },
  { text: 'Cell phone has no signal', genres: ['general'] },
  { text: "Car won't start during the chase", genres: ['general'] },
  { text: 'Someone investigates a strange noise alone', genres: ['general'] },
  { text: "A stranger's warning is completely ignored", genres: ['general'] },
  { text: 'The dog barks at nothing... or something', genres: ['general'] },
  { text: 'Basement or attic explored despite obvious danger', genres: ['general'] },
  { text: 'The group splits up to search the house', genres: ['general'] },
  { text: 'The lights flicker right before something happens', genres: ['general'] },
  { text: 'A character trips and falls while running away', genres: ['general', 'slasher'] },
  { text: 'Someone breaks the one rule they were told never to break', genres: ['general'] },
  { text: 'A thunderstorm perfectly times the mood', genres: ['general'] },
  { text: "Nobody believes the survivor's warning", genres: ['general'] },
  { text: 'A character hides in a closet while being hunted', genres: ['general', 'slasher'] },
  { text: 'Fake-out jump scare caused by a cat', genres: ['general'] },
  { text: 'A locked door fails to keep the evil out', genres: ['general'] },
  { text: 'An old family secret is uncovered', genres: ['general', 'supernatural'] },
  { text: 'A character explores an abandoned asylum or hospital', genres: ['general', 'psychological'] },
  { text: 'A warning label or omen is read and then ignored', genres: ['general'] },
  { text: "Security footage catches something that shouldn't be possible", genres: ['general', 'found-footage'] },
  { text: 'The car breaks down in the middle of nowhere', genres: ['general'] },
  { text: 'Someone lets a suspicious stranger inside', genres: ['general'] },
  { text: 'An obvious warning sign is ignored by the whole group', genres: ['general'] },
  { text: 'A scream draws characters toward danger instead of away', genres: ['general'] },
  { text: 'The power of teamwork saves the day at the last second', genres: ['general'] },
  { text: 'The "safe" daylight scene turns out not to be so safe', genres: ['general'] },

  // ---------- Slasher ----------
  { text: 'The "Final Girl" is the last one standing', genres: ['slasher'] },
  { text: "The killer is presumed dead but isn't", genres: ['slasher'] },
  { text: '"The call is coming from inside the house"', genres: ['slasher'] },
  { text: 'The babysitter is left alone with the kids', genres: ['slasher'] },
  { text: "The killer wears a mask hiding their true identity", genres: ['slasher'] },
  { text: 'A threatening text message from the killer', genres: ['slasher'] },
  { text: 'The killer turns out to be someone the group trusted', genres: ['slasher'] },
  { text: 'A phone call warns "get out of the house"', genres: ['slasher'] },
  { text: "The killer is hiding in the back seat of the car", genres: ['slasher'] },
  { text: "The killer's motive is revealed in a monologue", genres: ['slasher'] },
  { text: 'The killer picks off the group one by one', genres: ['slasher'] },
  { text: 'A final confrontation happens back where it all started', genres: ['slasher'] },
  { text: 'The killer shows up at a party or reunion uninvited', genres: ['slasher'] },
  { text: "A character recognizes the killer's signature weapon", genres: ['slasher'] },

  // ---------- Supernatural / Haunted House ----------
  { text: 'A mirror reveals something standing behind a character', genres: ['supernatural'] },
  { text: 'A creepy child says something unsettling', genres: ['supernatural'] },
  { text: 'A character reads aloud from a cursed book or tape', genres: ['supernatural'] },
  { text: "An old photograph shows something that wasn't there before", genres: ['supernatural'] },
  { text: 'A religious symbol fails to stop the evil', genres: ['supernatural'] },
  { text: 'A séance or ritual goes horribly wrong', genres: ['supernatural'] },
  { text: 'A character spots the ghost in a reflection first', genres: ['supernatural'] },
  { text: 'A creepy doll or toy moves on its own', genres: ['supernatural'] },
  { text: 'The house was built on a cursed burial ground', genres: ['supernatural'] },
  { text: "A character's shadow moves on its own", genres: ['supernatural'] },
  { text: 'A character hears their own name whispered', genres: ['supernatural', 'psychological'] },
  { text: 'A clock stops at the same time every night', genres: ['supernatural'] },
  { text: 'An urban legend turns out to be true', genres: ['supernatural'] },
  { text: 'A character sees a figure standing perfectly still in the distance', genres: ['supernatural', 'psychological'] },
  { text: "A character makes a deal with something they shouldn't have", genres: ['supernatural'] },
  { text: 'A priest, medium, or exorcist is called in to help', genres: ['supernatural'] },
  { text: "An object must be returned to its resting place to end the haunting", genres: ['supernatural'] },
  { text: 'The haunting follows the family when they try to move away', genres: ['supernatural'] },
  { text: 'A character is possessed and acts out of character', genres: ['supernatural'] },

  // ---------- Zombie / Outbreak ----------
  { text: 'A single zombie bite dooms a character who hides it from the group', genres: ['zombie'] },
  { text: 'The group barricades windows and doors against the horde', genres: ['zombie'] },
  { text: 'A character is bitten while saving someone else', genres: ['zombie'] },
  { text: 'Survivors argue about whether to trust a stranger', genres: ['zombie'] },
  { text: 'The military or government response makes things worse', genres: ['zombie'] },
  { text: 'A radio broadcast gives false hope of a safe zone', genres: ['zombie'] },
  { text: 'Someone insists a turned loved one isn\'t "really gone"', genres: ['zombie'] },
  { text: 'The horde is drawn by a loud noise or alarm', genres: ['zombie'] },
  { text: 'A character is overwhelmed after running out of ammo', genres: ['zombie'] },
  { text: 'The infection spreads faster than anyone expected', genres: ['zombie'] },
  { text: 'A supply run to the store goes wrong', genres: ['zombie'] },
  { text: 'The group loses a vehicle in the middle of the outbreak', genres: ['zombie'] },

  // ---------- Found Footage ----------
  { text: 'Found-footage camera shakes violently', genres: ['found-footage'] },
  { text: 'Static or distortion appears right before a scare', genres: ['found-footage'] },
  { text: 'A character live-streams their own demise', genres: ['found-footage'] },
  { text: 'Someone insists on continuing to film despite the danger', genres: ['found-footage'] },
  { text: "The camera battery or memory card conveniently runs out at a key moment", genres: ['found-footage'] },
  { text: "Night-vision footage reveals something the group didn't notice in the dark", genres: ['found-footage'] },
  { text: 'The footage was "recovered" after the group went missing', genres: ['found-footage'] },
  { text: 'A character narrates directly to the camera about their fear', genres: ['found-footage'] },
  { text: 'The camera is dropped but keeps recording', genres: ['found-footage'] },
  { text: 'GPS or map apps stop working once the group is in danger', genres: ['found-footage'] },
  { text: "A character apologizes to the camera as if it's their last recording", genres: ['found-footage'] },

  // ---------- Psychological ----------
  { text: 'A character wakes from a nightmare... or did they?', genres: ['psychological'] },
  { text: 'The main character questions their own sanity', genres: ['psychological'] },
  { text: "A twist reveals events weren't happening the way we thought", genres: ['psychological'] },
  { text: "A character sees someone or something others insist isn't there", genres: ['psychological'] },
  { text: 'Time seems to loop or repeat for a character', genres: ['psychological'] },
  { text: "A character's medication or treatment is suspiciously involved", genres: ['psychological'] },
  { text: 'The "monster" turns out to be a manifestation of grief or guilt', genres: ['psychological'] },
  { text: "A therapist or doctor doesn't believe the protagonist", genres: ['psychological'] },
  { text: 'Reality and memory blur together for the protagonist', genres: ['psychological'] },
  { text: "A character discovers they've done something horrific and forgotten it", genres: ['psychological'] },
  { text: 'The house or setting seems to change layout unexpectedly', genres: ['psychological'] },
  { text: 'A character is gaslit by someone close to them', genres: ['psychological'] },
  { text: 'The ending recontextualizes an earlier "safe" scene as sinister', genres: ['psychological'] },

  // ---------- Creature Feature / Monster ----------
  { text: 'The monster is only glimpsed in shadow or partial view at first', genres: ['creature'] },
  { text: 'A local warns the group not to go into the woods or water', genres: ['creature'] },
  { text: 'The creature turns out to be smarter than expected', genres: ['creature'] },
  { text: "A character is snatched from just outside the group's reach", genres: ['creature'] },
  { text: "The creature's origin is tied to a science experiment gone wrong", genres: ['creature'] },
  { text: 'The group discovers the remains of a previous victim', genres: ['creature'] },
  { text: 'A trap set for the creature fails or backfires', genres: ['creature'] },
  { text: 'The creature is revealed to be more than one', genres: ['creature'] },
  { text: 'Weapons that should work on the creature barely slow it down', genres: ['creature'] },
  { text: 'A character bonds with or tries to spare the creature', genres: ['creature'] },
  { text: 'The creature mimics a human voice to lure victims', genres: ['creature'] },
  { text: 'A flare or light source reveals the creature just in time', genres: ['creature'] },
];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateBoard(subgenre = DEFAULT_SUBGENRE) {
  const pool = TROPES.filter((t) => t.genres.includes('general') || t.genres.includes(subgenre));
  return shuffle(pool.map((t) => t.text)).slice(0, 25);
}
