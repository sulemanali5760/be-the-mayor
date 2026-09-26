# Research: comparable games for Be the Mayor

Game research lane, 2026-09-26. Web research plus design knowledge. Everything is summarised in our own words.

**Legend.** **[E]** marks an estimate: my own number, or community knowledge I didn't check against a primary source. Plain numbers come from the linked source. Timings like "wheat grows in 2 min" are from playing the games and from community wikis, so treat them as approximate.

**Why this file exists.** The owner stopped *Brick by Brick* because it was boring. Our own post-mortem ([brick-by-brick/docs/RESEARCH.md §e](../../../brick-by-brick/docs/RESEARCH.md)) found three causes:

1. Automation turned the player into a spectator and also cut their pay.
2. One tap repeated 50–100 times per job, with nothing new after job 2.
3. Money had nowhere to go, and the jobs had no named people in them.

Every recommendation here is checked against those three.

---

## 0. Summary

- **What BitLife gets right:** a funny, consequential choice every few seconds, and a whole life you can retell in one screenshot. It reached 42M downloads, 1.2M DAU and 7.8M MAU by 2020 as a text-only game ([PocketGamer.biz](https://www.pocketgamer.biz/stillfront-group-acquires-bitlife-developer-candywriter/)). **Take:** the card-and-choice layer and the story summary at the end.
- **What Hay Day and Township get right:** orders from named characters, visiting neighbours to trade and help, and a town that visibly grows. **Take:** orders as town problems, help requests, and a newspaper of other players' towns.
- **What Clash of Clans gets right:** your base is your identity, and other players visit it asynchronously as a snapshot. **Take:** snapshot visits. **Leave:** multi-day timers. Supercell itself keeps cutting them ([Dec 2023](https://supercell.com/en/games/clashofclans/blog/news/cost-and-time-reductions-december-2023), [Apr 2026](https://supercell.com/en/games/clashofclans/blog/release-notes/the-sound-of-clash-update)).
- **What Papers, Please, Reigns and Suzerain get right:** politics and morality work best as small, concrete decisions under pressure, with rules that change every day. They don't work as spreadsheets.
- **What Stardew and Animal Crossing get right:** a checklist you can see (bundles), a day with a natural end, and dream visits that nobody can break.
- **The biggest single risk** is a first-person task that is long, samey or hard at first. ConcernedApe regrets making Stardew's fishing too hard at the start ([GamesRadar](https://www.gamesradar.com/games/simulation/concernedape-regrets-making-stardew-valleys-fishing-minigame-too-hard-when-you-start-out-but-still-thinks-its-good-overall-i-know-its-controversial/)). Brick by Brick died of a long, samey one.

---

## 1. Comparable games

Each game follows the same shape: loop, pacing, economy, session, hooks, praise, complaints, and what we take from it.

### 1.1 BitLife – Life Simulator (Candywriter, 2018)

- **Core loop:** tap "Age +1". A year passes, 0–3 event cards pop up ("your coworker steals your lunch…"), and you pick a reaction. Between years you can open menus: education, jobs, relationships, crime, assets and activities.
- **Progression:** the life itself is the progression. School runs automatically until 18. Then you choose university, a trade or a job. Careers have ranks you climb by working hard, and there are special careers (fame, crime, politics) with extra requirements.
  - **Politics:** you run for Mayor, then Governor, then President. You split your campaign hours across policy platforms, and some guides recommend two mayoral terms before running higher ([Yahoo Tech guide](https://tech.yahoo.com/gaming/articles/become-president-bitlife-003516126.html), [r/BitLifeApp guide](https://www.reddit.com/r/BitLifeApp/comments/1j49bph/how_to_become_president_100_guide/)).
- **Pacing:** a whole life takes about 10–30 min **[E]**. Something "happens" every 2–10 s **[E]**.
- **Economy:** in-life money only, with property, cars and jewellery as sinks. The meta layer is paid: Bitizenship removes ads and adds features, and God Mode lets you edit characters. A 2019 plan to turn Bitizenship into a subscription was dropped after near-unanimous backlash ([BitLife wiki](https://bitlife-life-simulator.fandom.com/wiki/Bitizenship)).
- **Session:** one life, or part of one: 5–30 min **[E]**.
- **Retention hooks:**
  - "One more life."
  - 40 ribbons, 4 of them secret, awarded on your gravestone for how you lived ([wiki](https://bitlife-life-simulator.fandom.com/wiki/Ribbons)).
  - Weekly challenges.
  - Absurd stories people screenshot and share.
- **Praise:** freedom, dark humour, and that every life ends up with a story. Google Play rates it 4.4 from about 1.3M ratings ([Play](https://play.google.com/store/apps/details?id=com.candywriter.bitlife)).
- **Complaints:** too many ads for free players (one App Store review counts 8 ads in under 5 minutes, [App Store](https://apps.apple.com/hu/app/1374403536?see-all=reviews&platform=iphone)), rising paywalls ([Reddit](https://www.reddit.com/r/bitlife/comments/1kn61kr/is_bitcitizen_and_god_mode_worth_buying/)), and text menus that feel repetitive once you've seen the event pool **[E]**.
- **For us:** the event card layer, with its tone, speed and consequences, and a summary card at each career milestone. A career ladder to President is already proven fun in text form. We add a place (the town) and hands-on moments (first person).

### 1.2 Hay Day (Supercell, 2012)

- **Core loop:** plant, then harvest (wheat takes 2 min, other crops 5 min to several hours **[E]**). Turn crops into goods in production buildings. Fill truck orders from named townsfolk for coins and XP. Level up to unlock new buildings.
- **Progression:** fast at first, with a level every few minutes in the first session **[E]**. The Roadside Shop unlocks at level 7 ([wiki](https://hayday.fandom.com/wiki/Roadside_Shop)). Neighbourhoods (guilds) and the weekly Derby were added later ([Wikipedia](https://en.wikipedia.org/wiki/Hay_Day)). The Town arrives around level 34 **[E]**. Content unlocks stop at about level 126; after that, levels only give diamonds and fields ([wiki](https://hayday.fandom.com/wiki/Experience_Levels)).
- **Economy:**
  - Coins, plus Diamonds as the premium currency ([Wikipedia](https://en.wikipedia.org/wiki/Hay_Day)).
  - Sinks: land expansion, storage upgrades (silo and barn, which need rare items), decorations and new machines.
  - Silo and barn capacity is the real throttle.
- **Session:** 3–10 min, several times a day **[E]**. That matches GameAnalytics' average of 4–5 sessions per day ([GameDev Reports](https://gamedevreports.substack.com/p/gameanalytics-benchmarks-in-mobile)).
- **Social:**
  - A newspaper lists other players' shop items. You visit their farm to buy.
  - You can help friends' trees and boat crates.
  - Neighbourhood chat and requests.
- **Retention hooks:** timers finishing, orders refreshing, the weekly Derby, seasonal events, and the Farm Pass.
- **Praise:** charm, tactile harvesting (you swipe a sickle over the crops), and relaxed pacing.
- **Complaints:** mid-game storage walls, waiting, and slow expansion items ([Reddit starter guide](https://www.reddit.com/r/HayDay/comments/1jmcare/everything_i_wish_i_knew_starting_out_in_hayday/)).
- **For us:** orders with a person's face attached, the newspaper, visiting to trade and help, and 2-second tactile actions in the top-down view.

### 1.3 Township (Playrix, 2013)

- **Core loop:** Hay Day's farming and production feeds a **town**. Houses raise population, community buildings raise the population cap, and population gates new factories and buildings. Orders arrive by train, plane and helicopter.
- **Social:** co-ops, help requests on orders, and the weekly **Regatta**, where co-op members complete tasks to move a shared yacht up a race ([wiki](https://township.fandom.com/wiki/Regatta)).
- **Economy:** coins plus T-Cash (premium). Players complain about economy changes that push spending ([Facebook group](https://www.facebook.com/groups/3154528861433972/posts/4506039289616249/)).
- **Session:** 5–10 min, several times a day **[E]**.
- **Praise:** a town that grows around you, and the Regatta's team spirit ([App Store](https://apps.apple.com/us/app/township/id638689075?see-all=reviews)).
- **Complaints:** the push to spend, and co-ops pressuring members ("minimum 5 tasks a day" rules, [Reddit](https://www.reddit.com/r/TownshipGame/comments/1cxnuf4/regatta_question/)).
- **For us:** tie your citizens' happiness to what you can unlock, so helping people is literally what grows your career. A light co-op goal is fine. Don't give guilds a daily quota.

### 1.4 Clash of Clans (Supercell, 2012)

- **Core loop:** collect resources, upgrade buildings with builders (each builder does one upgrade at a time), train troops, and attack other players' bases for loot. Attacks run against a **snapshot of the defence** controlled by AI, and the owner watches the replay later ([Wikipedia](https://en.wikipedia.org/wiki/Clash_of_Clans)). A battle lasts at most 3 minutes.
- **Progression:** the Town Hall level gates everything. Early upgrades take seconds to minutes. Late upgrades took days to weeks until repeated cuts in time and cost ([Supercell Dec 2023](https://supercell.com/en/games/clashofclans/blog/news/cost-and-time-reductions-december-2023), [Apr 2026](https://supercell.com/en/games/clashofclans/blog/release-notes/the-sound-of-clash-update)).
- **Economy:**
  - Gold, Elixir and Dark Elixir, plus Gems (premium).
  - Sinks: upgrades and troops.
  - Builders are the real currency: 2 at the start, more for gems **[E]**.
- **Session:** 3–10 min: collect, start upgrades, one or two attacks **[E]**.
- **Retention hooks:**
  - Idle builders feel wasted, so you come back.
  - A shield after being raided.
  - Clan Wars, Clan Games and a monthly season pass.
  - Revenge attacks.
- **Praise:** strategic depth, and your base as self-expression.
- **Complaints:** long timers and gem pressure ([Wikipedia](https://en.wikipedia.org/wiki/Clash_of_Clans)). Deconstructor of Fun calls the Builder Base's daily attack cap restrictive ([DoF](https://www.deconstructoroffun.com/blog/2017/6/18/the-good-bad-ugly-of-clash-of-clans-builder-base)).
- **For us:** snapshot visits, and one clear building that shows your rank (their Town Hall is our City Hall). No PvP raids: they need a server-side battle simulation, and destroying someone's town clashes with "helping people". Keep timers in minutes, not days.

### 1.5 SimCity BuildIt (EA, 2014) and Pocket City 1/2 (Codebrew, 2018/2023)

**SimCity BuildIt**

- **Core loop:** factories make materials, shops turn them into goods, and goods upgrade homes. Upgraded homes give population, money and XP, which unlock buildings. Service coverage (fire, police, water) keeps citizens happy ([TouchArcade](https://toucharcade.com/2014/12/23/simcity-buildit-review/)).
- **Economy:** Simoleons, SimCash (premium) and storage-limited materials.
- **Complaints:**
  - Desirable buildings locked behind premium currency, and random expansion items ([TouchArcade](https://toucharcade.com/2014/12/23/simcity-buildit-review/)).
  - The game "requires" too much time ([r/SCBuildIt](https://www.reddit.com/r/SCBuildIt/comments/nrxu7i/does_anyone_feel_this_game_requires_too_much_time/)).
  - Support and monetisation ([App Store](https://apps.apple.com/nz/app/simcity-buildit/id913292932?see-all=reviews&platform=iphone)).

**Pocket City**

- **Core loop:** premium, with no microtransactions. XP from quests and challenges unlocks buildings ([pocketcitygame.com](https://pocketcitygame.com/info.html), [dev's Reddit post](https://www.reddit.com/r/iosgaming/comments/7foha6/a_city_building_game_with_no_microtransactions/)).
- **Pocket City 2** adds an avatar who **walks around your own city** doing quests. Players praise that free roam ([App Store](https://apps.apple.com/us/app/pocket-city-2/id1533709428?see-all=reviews), [ResetEra](https://www.resetera.com/threads/pocket-city-2-cool-looking-city-builder-where-you-can-explore-and-do-quests-inside-your-city-as-you-build-summer-2023-mobile-no-mtx.700462/)).
- **Session:** 10–30 min **[E]**.
- **Praise:** fair, and no waiting.

**For us:** Pocket City 2 is the closest precedent for "top-down city plus a person walking in it". Its pitch of "no long wait times" is a selling point in reviews. SimCity BuildIt shows how material chains plus timers plus premium currency turn a city builder into a chore.

### 1.6 Cities: Skylines (Colossal Order / Paradox, 2015)

- **Core loop:** zone, build roads, and supply services (power, water, sewage first; schools, police, fire, health and garbage later). Traffic and budget are the real puzzles. **Milestones unlock by population** ([Wikipedia](https://en.wikipedia.org/wiki/Cities:_Skylines)).
- **Chirper:** a fake social feed of citizens reacting to your city.
- **Scale:** 12M copies sold by June 2022 ([Wikipedia](https://en.wikipedia.org/wiki/Cities:_Skylines)).
- **Session:** 1–3 h **[E]**.
- **Praise:** scale, freedom and modding.
- **Complaints at launch:** no disasters or random events, and a weak tutorial ([Wikipedia](https://en.wikipedia.org/wiki/Cities:_Skylines)). The sequel launched to mixed reviews in 2023.
- **For us:**
  - Chirper as the voice of citizen needs: short, funny, named.
  - Population milestones as a clear unlock gate.
  - The launch criticism shows that a sandbox without events or goals goes flat.

### 1.7 Tropico 6 (Limbic / Kalypso, 2019)

- **Core loop:** you are El Presidente of a Caribbean island through four eras. You build an economy, keep **factions** happy (communists, capitalists, religious, militarists and others), win or rig **elections** (with speeches that pick promises), issue edicts, and stash money in a Swiss account ([Wikipedia](https://en.wikipedia.org/wiki/Tropico_6)).
- **Commercial result:** the fastest-selling game in the series, 50% above Tropico 5's launch.
- **Session:** 1–3 h missions **[E]**.
- **Praise:** comedy, music and writing, plus its satire of democracy abused through game mechanics ([Wikipedia](https://en.wikipedia.org/wiki/Tropico_6)).
- **Complaints:** objectives aren't clear, the economy is baffling, the main screen is convoluted, and PCGamesN called it fun but forgettable ([Wikipedia](https://en.wikipedia.org/wiki/Tropico_6)).
- **For us:**
  - Satire works because the country is fictional.
  - Factions with named leaders who ask favours.
  - An election speech as a set of choices.
  - Tropico's complaints warn us: always show the next objective, and keep the economy readable.

### 1.8 Democracy 4 (Positech, 2020)

- **Core loop:** you lead a government and pay **political capital**, generated by loyal ministers, to add or change policies. Every policy moves voter groups (parents, capitalists, socialists, religious and so on) and outcomes such as crime and air quality through a visible web of effects. You also handle situations and dilemmas, keep your promises, and win elections ([Wikipedia](https://en.wikipedia.org/wiki/Democracy_(video_game))).
- **Session:** 1–2 h per term **[E]**.
- **Praise:** makes you think about who each policy hurts. The Guardian even ran real UK manifestos through it ([Wikipedia](https://en.wikipedia.org/wiki/Democracy_(video_game))).
- **Complaints:** it feels like a spreadsheet, and it's opaque. In Democracy 3 you often couldn't see what a policy would do without spending scarce capital to inspect it ([Steam review](https://store.steampowered.com/app/245470/)). Mixed Metacritic scores across the series.
- **For us:** voter groups as faces with a mood, and "every choice pleases someone and annoys someone". Show effects *before* the player commits. Make the web small: 4–6 groups, not 20+.

### 1.9 Animal Crossing: New Horizons (Nintendo, 2020)

- **Core loop:** a real-time clock. Each day brings fresh chores (fossils, fruit, shop stock, villager chats) and a slow island-design project. Bells pay off house loans, and Nook Miles reward small tasks.
- **Visiting:**
  - **Live visits** by Dodo code. Only people you have marked as "best friends" can use the shovel or axe, so visitors can't cut trees or dig up flowers ([Reddit](https://www.reddit.com/r/AnimalCrossing/comments/frw9zl/whats_the_worst_thing_visitors_can_do_to_your/), [Washington Post](https://www.washingtonpost.com/video-games/2020/04/06/animal-crossing-etiquette-guide-dos-donts-online-multiplayer/)).
  - **Dream visits** load a server-stored **snapshot** of someone's island. Nintendo's support page says visitors "will not be able to make any changes to the actual islands" ([Nintendo](https://www.nintendo.com/en-gb/Support/Purchases-Subscriptions/Games/How-to-Visit-Another-Player-s-Dream-Island-Animal-Crossing-New-Horizons--1821306.html)). The owner re-uploads to refresh the snapshot ([AOEAH](https://www.aoeah.com/news/4331--acnh-30-dream-islands-guide--new-dream-addresses)).
- **Session:** 15–45 min a day **[E]**.
- **Hooks:** the real-time day, seasons, and sharing islands and dream codes online.
- **Complaints:** the daily routine gets thin after a few months, and the online setup is clunky **[E]**.
- **For us:** **dream visits are exactly our async model.** A read-only snapshot and a permission tier for anything that changes a town.

### 1.10 Stardew Valley (ConcernedApe, 2016)

- **Core loop:** a day runs 6am–2am. Every 10 in-game minutes take 7 real seconds, so a day lasts about 14 real minutes ([wiki](https://stardewvalleywiki.com/Day_Cycle)). **Energy** limits how much tool work you can do. You choose between farming, mining, fishing, foraging and friendship.
- **Community Center bundles** ([wiki](https://stardewvalleywiki.com/Bundles)): a visible checklist of items per room. Each finished room fixes something in town (the bridge, the minecarts, the greenhouse). There's also a paid shortcut through the Joja corporation, which is a moral choice.
- **Economy:** gold. Sinks are buildings, tools and seeds. The bundles take items, not money.
- **Session:** 1–3 in-game days, so 15–45 min **[E]**.
- **Praise:** freedom, the bundles, and the townsfolk.
- **Complaints:** fishing is too hard at first. Its creator agrees: "I think it starts out too hard" ([GamesRadar](https://www.gamesradar.com/games/simulation/concernedape-regrets-making-stardew-valleys-fishing-minigame-too-hard-when-you-start-out-but-still-thinks-its-good-overall-i-know-its-controversial/), [Polygon](https://www.polygon.com/gaming/24118191/stardew-valley-fishing-defense/)).
- **For us:**
  - A "day" with a natural end.
  - A bundle board for town repairs, where every item is visibly placed in town.
  - A tempting "sell out" shortcut as a moral choice.
  - First-person tasks must start easy.

### 1.11 The Sims 4 (Maxis / EA, 2014)

- **Core loop:** keep needs up (hunger, bladder, hygiene, social, fun, energy). Build skills that raise career performance, and chase aspirations and wants ([Wikipedia](https://en.wikipedia.org/wiki/The_Sims_4)). Most careers happen off-screen as a "rabbit hole". Some DLC careers are playable at the workplace.
- **Scale:** 85M+ players by May 2024, and free to play since 2022.
- **Complaints:** a pile of expensive DLC, features missing at launch, bugs, and backlash in 2026 over a paid-mod currency ([Wikipedia](https://en.wikipedia.org/wiki/The_Sims_4)).
- **For us:** skills gate careers, and short-term "wants" steer each session. Needs meters are a chore in a short-session game **[E]**, so keep at most one (energy or time). Rabbit-hole careers are what our first-person moments replace.

### 1.12 Papers, Please (Lucas Pope, 2013) and Not Tonight (PanicBarn, 2018)

**Papers, Please**

- **Core loop:** each day you inspect entrants' documents against the rules, which change daily. You're paid per correct entrant and fined for mistakes. After work you choose whether to spend on food, heat or medicine for your family. Rebels and bribes add moral choices, and there are 20 endings ([Wikipedia](https://en.wikipedia.org/wiki/Papers,_Please)).
- **Commercial result:** more than 5M copies sold by its tenth anniversary.
- **Session:** one in-game day takes 5–10 min **[E]**.
- **Praise:** emotional weight created through mechanics.
- **Complaints:** some found the paperwork tedious.

**Not Tonight**

- **Core loop:** the same formula, as a bouncer in an alternate post-Brexit Britain. You check IDs against escalating rules, pay rent and risk deportation ([Wikipedia](https://en.wikipedia.org/wiki/Not_Tonight_(video_game))).
- **Reception:** mixed at launch, better for the later edition. Reviewers mostly measured it against Papers, Please.

**For us:**

- **A new rule each day** is the fix for one-verb sameness (Brick risk 2).
- Personal costs, like the family bill, make small wages matter.
- Satire of real politics splits reviewers. Keep our towns and parties fictional.

### 1.13 Two Point Hospital (Two Point / Sega, 2018)

- **Core loop:** comical illnesses arrive. You build diagnosis and treatment rooms, hire and train staff, and chase a star rating per hospital. Kudosh buys cosmetic unlocks ([Wikipedia](https://en.wikipedia.org/wiki/Two_Point_Hospital)).
- **Scale:** 1M+ units sold on PC.
- **Session:** 30–120 min per hospital **[E]**.
- **Praise:** humour and style.
- **Complaints:** repetitiveness, rebuilding from scratch at each new hospital, and late-game micromanagement.
- **Note:** Two Point Hospital has **no first-person or Overcooked-style mini-games**. It stays top-down throughout. What we can take is "problems as rooms and staff": every problem has a physical fix you place in the world, plus jokes.
- **For us:** a town problem shows up as a funny thing on the map (the pothole bus, the pigeon plague). The fix is a building, a person you hire, or a task you do yourself. Don't reset progress when the player moves up to a new office.

### 1.14 Mayor, politician and career-ladder games

- **Reigns** (Nerial, 2016, [Wikipedia](https://en.wikipedia.org/wiki/Reigns_(video_game))): you swipe left or right on cards from advisors. Four meters (church, people, army, treasury) must stay away from both 0 and 100, and each reign ends in a funny death. A reign lasts a few minutes **[E]**. **Take:** 2-option cards that move 2–4 bars, where both extremes are bad.
- **Suzerain** (Torpor, 2020): text-heavy. You serve your first term as president of a fictional country, and you're judged on reforms, allies and the constitution ([Third Coast Review](https://thirdcoastreview.com/games-tech/2020/12/03/game-review-suzerain), [IFDB](https://ifdb.org/viewgame?id=z4ux1h8f8hr5uaw3)). Praised for writing and dilemmas. Some players feel the implementation of the "you as a person" idea falls short ([Reddit](https://www.reddit.com/r/suzerain/comments/1qokm7k/my_personal_review_of_the_game_for_sordland/)). **Take:** named ministers and rivals, and consequences that come back several turns later.
- **President: Simulator Game** (Hidden Lake, mobile): pass laws and manage a budget and approval. Rated 3.9 from about 28k ([Play](https://play.google.com/store/apps/details?id=com.hiddenlake.president)). This shows demand for the fantasy, with average execution.
- **BitLife politics** (see 1.1): the only mainstream game with the whole ladder from ordinary person to president in it, but it's all menus.

**Gap in the market:** no game we found combines *starting as a labourer*, *a town you see and own*, *hands-on work* and *elected office up to president*. That gap is our pitch **[E]**.

### 1.15 Comparison table

| Game | Loop length | Visible goal | Choices with trade-offs | Social | What kills it (per reviews) |
|---|---|---|---|---|---|
| BitLife | 5 s per card | next age, next career rank | every card | shared screenshots | ads, paywalls |
| Hay Day | 2 min crop | next order, next level | little | visit, trade, help | storage walls |
| Township | 2–5 min | population gate | little | co-op, Regatta | spend pressure |
| Clash of Clans | 3 min battle | next Town Hall | army and upgrade order | raids, clans | long timers |
| SimCity BuildIt | 1–5 min | next building | little | trade | timers, premium buildings |
| Pocket City | minutes | quest list | zoning | none | none major |
| Cities: Skylines | hours | population milestone | layout and budget | mods | no events at launch |
| Tropico 6 | hours | mission goals | factions | none | unclear goals |
| Democracy 4 | 1 turn | election | every policy | none | spreadsheet feel |
| Animal Crossing | 1 day | loan, design | few | dream and live visits | thins out |
| Stardew | 14 min day | bundles | how to spend the day | co-op | early fishing |
| Papers, Please | 1 day | rent and family | every entrant | none | tedium |
| Two Point | per room | star rating | room and staff | none | repetition |
| Reigns | 1 card | survive | every card | none | shallow over time |

---

## 2. Async multiplayer patterns

### 2.1 How games handle visits

| Pattern | Examples | How it works | Fit for Be the Mayor |
|---|---|---|---|
| **Read-only snapshot** | Animal Crossing dream islands, Clash of Clans defences | The owner uploads a copy of their state, and visitors load that copy. Visitors can't change the real save. | **MVP.** Upload the town snapshot when a session ends. |
| **Trade stall** | Hay Day roadside shop and newspaper | The visitor buys listed items. The server moves coins and items. | v2. It needs server-side items. |
| **Help stamp** | Hay Day tree and boat help, Township help requests | The owner posts a request, a visitor fulfils it, and both are rewarded. | **MVP (light):** "help" a posted town problem. It's server-counted, and the owner collects the reward. |
| **Like or appreciation** | Death Stranding likes ([analysis](https://econsquawk.substack.com/p/the-ingenuity-of-death-strandings)), dream-island ratings | Positive-only feedback, nothing to spend it on, and no negatives. | **MVP.** Likes feed reputation. |
| **Preset messages** | Dark Souls templates ([Bad at Sports](https://badatsports.com/2013/praise-the-sun-the-contextual-language-of-dark-souls/), [r/gamedesign](https://www.reddit.com/r/gamedesign/comments/1cgcozl/seriously_why_does_the_soulslike_message_system/)) | Messages are built from a fixed word list, so they can't carry slurs or links. | **MVP** for signs in town ("Nice park!", "Try the bakery"). |
| **Gift** | Hay Day and FarmVille gifts, Township | You send an item to a friend. | Later, with caps. FarmVille-style gift spam backfired (see §5.4). |
| **PvP raid** | Clash of Clans | Attack an AI-run snapshot and take loot. | **No.** It conflicts with the theme and needs a server-side battle simulation. |
| **Shared-goal event** | Township Regatta, Hay Day Derby, Clash Clan Games | A group does tasks for a weekly shared score. | Later. |
| **Leaderboard or season** | CoC seasons, Derby leagues | Weekly or monthly ranking with a reset. | v2. Rank only server-counted values such as likes received and help given. |

### 2.2 Moderation: preset interactions, not free text

- **Preset first.** Dark Souls, Death Stranding and Clash Royale emotes show that fixed phrases can still be expressive, and can even become culture. Free text needs a filter, a report tool and human review, which is a whole moderation job a small team can't staff.
- **Permission tiers.** Animal Crossing lets only "best friends" use destructive tools. Our version: visitors never change the town. "Helping" is recorded against the *owner's* problem list and never touches their buildings.
- **Names.** Player and town names are the only free text in the MVP. Run them through a word filter, and consider a generated fallback ("Mayor of Brookfield"). Add a report button on every visited town.
- **No DMs** in MVP or v2.

### 2.3 Cheat resistance for a client-saved game

The rule every source agrees on is "never trust the client" ([r/gamedev](https://www.reddit.com/r/gamedev/comments/hbweuh/how_to_minimize_cheating_in_a_multiplayer_game/), [Ostorlab](https://blog.ostorlab.co/mobile-game-security.html)). A browser game with local saves can't stop anyone from editing their own save, so contain the damage instead:

1. **Single-player progress stays local.** Someone who edits their coins only spoils their own game. Don't fight it.
2. **Anything others see or rank goes through the server.**
   - Likes and help are written by the *giver's* request and counted on the server. The receiver never reports their own likes.
   - Give each account a daily cap on likes and help given (for example 20 **[E]**), and don't count new accounts for 24 h **[E]**.
3. **Plausibility checks on snapshot upload.**
   - Building count ≤ the maximum allowed by the player's career rank.
   - Career rank ≤ what's possible in the account's age and play time.
   - Reject impossible snapshots rather than "fixing" them.
4. **Leaderboards rank only server-counted things** (likes, help, visits), never client-reported money or level. Developers on the GameMaker forum agree that client-reported leaderboards can't be protected without server-side logic ([GameMaker forum](https://forum.gamemaker.io/index.php?threads/mobile-game-with-leaderboards-how-to-handle-cheating.122245/)).
5. **Rate-limit uploads** (for example, one snapshot per 5 min **[E]**), so a script can't flood the pool.
6. **Visit selection** draws from recent, non-reported snapshots, and mixes friends with random towns at a similar career stage.

---

## 3. Mixing views: a top-down town plus close-up or first-person actions

| Game | Base view | Close-up or mini action | Length | Lesson |
|---|---|---|---|---|
| Hay Day | top-down farm | swipe the sickle, drag feed onto animals | 1–3 s | Tactile actions *in* the base view feel good and never interrupt. |
| Pocket City 2 | city builder | walk your avatar through your own city, doing quests | 1–5 min per quest **[E]** | Walking your own creation is the payoff, and players praise it. |
| Gardenscapes and Homescapes | renovation meta | a match-3 level earns stars that pay for renovation tasks ([GameRefinery](https://www.gamerefinery.com/casual-match3-meta-layer-new-winning-formula/)) | 1–3 min per level **[E]** | The meta layer (story and decoration) gives the short action a reason, and the action paces the meta. |
| Stardew Valley | top-down farm | fishing minigame | 5–20 s | Keep it short, but it must start easy (the creator's regret). |
| Papers, Please | daily day cycle | the desk inspection is the whole game | 5–10 min per day **[E]** | A new rule each day keeps one verb fresh. |
| Overcooked | level select map | kitchen rush | 2.5–4 min **[E]** | A fixed short timer plus a 3-star score makes replay tempting. |
| PowerWash Simulator | none (first person only) | washing | 20–90 min per job **[E]** | Satisfying, but players complain about long jobs (see our Brick research). |
| Two Point Hospital | top-down | none, it's all management | none | Humour and many problem types carry it, not mini-games. |
| Brick by Brick (ours) | none | bricklaying | 50–100 taps per job | What killed it: too long, one verb, no twist. |

**Rules for Be the Mayor's first-person tasks:**

1. **Length:** 20–90 s for routine tasks, 2–4 min for a "big job" at most. Never longer without a checkpoint **[E, from the table above]**.
2. **Cadence:** at most about 1 minute of first person for every 2–3 minutes of top-down or card play **[E]**. Alternate the modes.
3. **One twist every time** (Papers, Please rule changes, Brick risk 2): a cracked brick, rain, the client changing their mind, a rival watching.
4. **Start easy.** The first try at each task should be nearly impossible to fail (Stardew's lesson).
5. **The result shows in the town.** The wall you built stands on the map with the client's name on it (Gardenscapes and Hay Day).
6. **Delegation once mastered.** After 3 stars, "send a worker" finishes the task off-screen for about 70% pay **[E]**. This only works because your *time* now has a better use: politics, helping, visiting. That's the fix for Brick risk 1.
7. **The top-down view keeps small tactile actions** (tap to collect, drag to assign) so it never feels like a menu.

---

## 4. Anti-boredom rules for a career-to-president arc

1. **Something new at least every 2–3 minutes in the first hour, and every session after that** **[E]**: a new verb, rule, person or place. BitLife delivers novelty every few seconds. Brick by Brick went dry after job 2.
2. **A visible next goal on screen at all times**, with progress shown (Stardew bundles, CoC Town Hall, Cities milestones). Tropico's biggest complaint was unclear objectives.
3. **Every choice costs something.** Money against reputation against time against one voter group (Democracy, Reigns, Papers, Please). If one option is always best, cut the choice.
4. **Show the effect before commitment** (Democracy's opacity complaint). Put icons on each option: +€, −😠 Shopkeepers.
5. **Named people, not "citizens"** (Hay Day order-givers, Stardew townsfolk, Suzerain ministers, Brick risk 3). Each order, problem and event comes from someone with a face and a line.
6. **Surprise events** on a schedule you can't predict: about one per 10-minute session **[E]**. Examples: a storm, a scandal, a strike, a visiting celebrity. Cities: Skylines was criticised for lacking events.
7. **Humour and drama in every card.** BitLife and Two Point both lean on absurd, slightly dark jokes. Satire stays on fictional parties (Tropico works, Not Tonight split reviewers).
8. **Consequences come back later.** A favour you granted as a councillor returns as a scandal in your mayoral race (Suzerain, BitLife).
9. **Failure is a story, not a reset.** You can lose an election. You keep your town and your reputation, and you get a funny newspaper headline (BitLife deaths and ribbons).
10. **A shareable summary** at each promotion or term end: a portrait card with a title and stats, like a BitLife ribbon or gravestone.
11. **Short sessions end on a hook:** a timer finishing overnight, a request from a neighbour, or tomorrow's newspaper (Hay Day, CoC). Keep timers in minutes to hours, never days.
12. **Money always has a destination.** The next self-upgrade, the next town fix and the campaign fund are always shown with a price (Brick risk 3).
13. **Old verbs get upgraded, not repeated.** A labourer lays bricks. A foreman checks 3 workers' walls. A mayor cuts the ribbon. The verb scales up with the office.

---

## 5. Recommendations for Be the Mayor

### 5.1 The first 15 minutes, minute by minute **[E: target design, to be playtested]**

| Time | The player does | Sees | Unlocks |
|---|---|---|---|
| 0:00–0:30 | Names themselves and the town (2 taps; a suggested name is prefilled). | A BitLife-style card: "You're 19. Brookfield has 212 people, a broken bridge, and a mayor nobody likes." Then the top-down town, grey and run-down. | Town view. Money €0 and Reputation 0 bars. |
| 0:30–2:00 | Picks 1 of 2 jobs on the board (both named): *"Frau Keller needs a garden wall"* or *"Café Lindner needs a dishwasher"*. Plays it in first person for 60–90 s. It's very easy and very juicy. | Paid on the spot. The camera flies up and **the wall stands in the town**, labelled "Keller's wall – built by you". | Job board. First skill star. |
| 2:00–3:30 | Taps a speech bubble over the bus stop: "Roof leaks, again." Chooses: spend €20 fixing it (+Rep, −money) or save for rent. | The first trade-off, with its effects shown before choosing. A Chirper-style line from a named citizen reacts. | Town problems board. Reputation. |
| 3:30–5:00 | Plays the second job type, a **different verb** (delivery route drawn on the top-down map, 45 s). A twist: rain. | A new part of town is revealed. | Second job type. The day/energy bar ("3 jobs left today"). |
| 5:00–6:00 | Gets an event card: the boss asks them to cut corners on a job. Yes (+€, a risk later) or no (+Rep, −€). | The humour lands. "This will be remembered" is tagged on the card. | The event system and a consequence hook. |
| 6:00–7:30 | **Upgrades themselves:** chooses night school (Trade), an online course (needs a second-hand computer, €60), or saving for a degree. | The career ladder appears for the first time: Labourer → Skilled → Helper → Councillor → **Mayor** → … → President, with *their portrait* on the first rung. | Self-upgrade. A course timer (3 min real, runs while they play). |
| 7:30–9:30 | **Helps the town:** the first community fix (repaint the playground, a 60 s close-up task) plus a choice of which problem the town fixes first. | 3 citizen groups (Families, Shopkeepers, Seniors) each show a mood face. One cheers, one grumbles. | Citizen groups (the seed of the Democracy layer). |
| 9:30–11:00 | **Visits another town** (a guided first visit to a curated seed town, then real snapshots). Leaves a like and a preset sign, and "helps" one posted problem. | Another player's town with a mayor statue and City Hall: *this is where you're going*. | Visits, likes, help. The first visitor reward. |
| 11:00–12:30 | A surprise event: a storm knocks down the bridge railing. Chooses: help clean up in person (45 s task, +Rep) or work the paid job (+€). | The newspaper front page: "Local hero?" or "Where was everyone?" | Newspaper. Surprise events. |
| 12:30–14:00 | The course finishes, and a better job unlocks (Skilled). Takes one skilled job with a new tool. | A promotion card, BitLife-style, that can be shared as an image. | Rank 2. Shareable summary card. |
| 14:00–15:00 | Sees the hook: *"Council by-election in 3 days. You need Rep 100 and 2 group endorsements."* Starts an overnight upgrade. | A goal bar, a countdown, and a neighbour's help request waiting for tomorrow. | The first political goal. The return hook. |

By minute 15 the player has 2–3 first-person tasks (under 4 min in total), 3 choices with trade-offs, 1 surprise, 1 visit, 1 promotion and a named next goal. They've played none of those for more than 90 s in a row.

### 5.2 Core loops at three levels

**1-minute action loop.** Pick a thing on the map (a job, a problem or a person) → preview the cost and effect → do it: a 20–90 s first-person task, a 5 s card choice, or a 2 s tap → the result appears in the town, a named person reacts, and money, Rep or skill ticks up.

**10-minute session loop** **[E]:**

1. The **newspaper** shows what happened while you were away: visitors' likes and help, a consequence landing, headlines.
2. Spend today's energy on 3–5 actions from the job board or the problem board, each a trade-off between money, Rep, skill and time.
3. **One surprise event** or moral card.
4. Put money into a **self-upgrade** or a **town fix**, and watch the progress bar toward the next rank move.
5. **Visit 1–2 towns**: like, sign, help.
6. End on a hook: an upgrade that finishes in 1–8 h, tomorrow's election countdown, a neighbour's request.

**Multi-day career arc** **[E, pacing to be tuned by data]:**

| Stage | Real play time to reach | New verb or layer | Proof from other games |
|---|---|---|---|
| Labourer | start | 2–3 job verbs, energy per day | Stardew day, Brick prototype |
| Skilled (trade, degree, computer) | about 15 min – 1 h | better jobs, remote jobs, delegating mastered tasks | BitLife education, Sims skills |
| Community Helper | day 1–2 | town problem board, citizen groups, help requests | Township, Two Point |
| Councillor | day 3–5 | by-election; vote on 1 proposal per session; allies and rivals | Suzerain, Democracy |
| **Mayor** | day 7–10 | budget, policies (4–6 levers), the permit desk (Papers-style rule of the day), mayoral election | Tropico, Democracy, Papers, Please |
| Governor or Minister | day 14–21 | several towns: visiting other *players'* towns becomes part of the job ("inspect 3 towns"); regional events | CoC clans, Township co-op |
| **President** | day 30–45 | national crises as big card chains; the legacy card; a new-term or prestige loop | Reigns, Tropico, BitLife |

Elections can be lost. Losing costs time, not the town, and produces a funny story card.

### 5.3 Top 15 features to add

Impact and Effort are on a 1–5 scale. **When:** MVP means before the first public build, v2 the next milestone, later after that.

| # | Feature | Source game(s) | Impact | Effort | When |
|---|---|---|---|---|---|
| 1 | **Event cards** with 2–3 choices, humour, visible effects and delayed consequences | BitLife, Reigns, Suzerain | 5 | 2 | MVP |
| 2 | **Job board with 2 named offers**; each job a 20–90 s first-person task with one twist | Hay Day orders, Papers, Please, Brick lesson | 5 | 3 | MVP |
| 3 | **Career ladder always on screen**, with the next goal's requirements as a checklist | Stardew bundles, CoC Town Hall, BitLife politics | 5 | 2 | MVP |
| 4 | **Town problems board**: named citizen requests whose fixes appear on the map | Township, Two Point, Hay Day | 5 | 3 | MVP |
| 5 | **Async visits to snapshot towns**, with likes, preset signs and help stamps | Animal Crossing dreams, Hay Day, Dark Souls | 5 | 3 | MVP |
| 6 | **Self-upgrades** (course, trade, degree, computer) on short timers that run while you play | BitLife education, Sims skills, CoC builders | 4 | 2 | MVP |
| 7 | **Newspaper** "while you were away" plus a Chirper-style citizen feed | Hay Day newspaper, Cities: Skylines Chirper | 4 | 2 | MVP |
| 8 | **Shareable promotion or term card** (title, stats, funniest moment) | BitLife ribbons | 4 | 2 | MVP |
| 9 | **Citizen groups (4–6) with mood faces**, and **elections** with a speech of promise choices | Democracy 4, Tropico 6 | 5 | 4 | v2 |
| 10 | **Surprise town events** (storm, scandal, strike, celebrity visit), about 1 per session | SimCity, Tropico, Cities: Skylines criticism | 4 | 3 | v2 |
| 11 | **Rule-of-the-day permit desk** for Councillor and Mayor: approve or deny with changing rules and bribes | Papers, Please, Not Tonight | 4 | 3 | v2 |
| 12 | **Delegate mastered tasks** at reduced pay, so your time moves up to politics | Brick risk 1, Two Point staff | 4 | 2 | v2 |
| 13 | **Named rival politician** (the current mayor) with an agenda, and scandals that echo back | Suzerain, Tropico faction leaders | 4 | 3 | v2 |
| 14 | **Help requests between players** (post a need; helpers earn Rep, the owner gets the fix) | Hay Day, Township | 4 | 3 | v2 |
| 15 | **Walk mode**: stroll your own town in first person and talk to citizens | Pocket City 2 | 3 | 4 | later |

Runners-up for later: a weekly town fair with a like leaderboard (Hay Day Derby, CoC seasons), a light co-op or party (Township Regatta, *no quotas*), and a "sell out" shortcut, a corporate donor who pays for the campaign at a cost to reputation (Stardew's Joja).

### 5.4 Five things NOT to do

1. **Don't repeat one verb 50–100 times per task.**
   - Brick by Brick died of it ([our §e](../../../brick-by-brick/docs/RESEARCH.md)).
   - Two Point Hospital's main criticism is repetitiveness ([Wikipedia](https://en.wikipedia.org/wiki/Two_Point_Hospital)).
   - Papers, Please avoided the problem only by changing its rules daily, and some players still found it tedious ([Wikipedia](https://en.wikipedia.org/wiki/Papers,_Please)).
   - **Cap: 90 s per routine task, one twist each time.**
2. **Don't gate progress behind long timers or pay-to-skip.**
   - SimCity BuildIt players complain the game eats their time and locks the best buildings behind premium currency ([Reddit](https://www.reddit.com/r/SCBuildIt/comments/nrxu7i/does_anyone_feel_this_game_requires_too_much_time/), [TouchArcade](https://toucharcade.com/2014/12/23/simcity-buildit-review/)).
   - Supercell keeps shortening Clash timers ([2023](https://supercell.com/en/games/clashofclans/blog/news/cost-and-time-reductions-december-2023), [2026](https://supercell.com/en/games/clashofclans/blog/release-notes/the-sound-of-clash-update)).
   - EA's 2014 Dungeon Keeper remake became the textbook timer backlash ([Wikipedia](https://en.wikipedia.org/wiki/Dungeon_Keeper_(2014_video_game))).
   - Pocket City sells itself on having no waits.
3. **Don't let money pile up without a destination or a person behind it.**
   - Brick risk 3 (the shop ran dry around job 3–4, and the jobs were anonymous).
   - Tropico's complaints: unclear objectives and a baffling economy ([Wikipedia](https://en.wikipedia.org/wiki/Tropico_6)).
   - **Always show the next thing to buy, with a price and a face.**
4. **Don't open free text, harmful visits or nagging social prompts.**
   - Animal Crossing had to restrict destructive tools to best friends ([Washington Post](https://www.washingtonpost.com/video-games/2020/04/06/animal-crossing-etiquette-guide-dos-donts-online-multiplayer/)).
   - FarmVille lost 4.4M players once Facebook blocked its notification spam ([GamesIndustry.biz](https://www.gamesindustry.biz/new-facebook-rules-cause-drop-in-gamer-numbers)).
   - Township co-ops that impose daily quotas create pressure ([Reddit](https://www.reddit.com/r/TownshipGame/comments/1cxnuf4/regatta_question/)).
   - **Use preset interactions and read-only snapshots, and no invite or gift nags.**
5. **Don't make the first try hard or front-load systems.**
   - ConcernedApe regrets Stardew fishing's hard start ([GamesRadar](https://www.gamesradar.com/games/simulation/concernedape-regrets-making-stardew-valleys-fishing-minigame-too-hard-when-you-start-out-but-still-thinks-its-good-overall-i-know-its-controversial/)).
   - Democracy is called opaque and spreadsheet-like ([Steam](https://store.steampowered.com/app/245470/)).
   - Cities: Skylines was faulted for a weak tutorial ([Wikipedia](https://en.wikipedia.org/wiki/Cities:_Skylines)).
   - About 20% of players don't finish the first tutorial quest in DeltaDNA's data ([Udonis](https://www.blog.udonis.co/mobile-marketing/mobile-games/first-time-user-experience)).
   - Median mobile D1 retention is only about 22%, against 64–68% for the top 1% ([GameAnalytics 2026](https://www.gameanalytics.com/reports/2026-mobile-pc-gaming-benchmarks)).
   - **Teach one system per 1–2 minutes, by doing it.**

---

## Sources

- BitLife:
  - [PocketGamer.biz (Stillfront acquisition)](https://www.pocketgamer.biz/stillfront-group-acquires-bitlife-developer-candywriter/)
  - [Google Play](https://play.google.com/store/apps/details?id=com.candywriter.bitlife)
  - [Ribbons wiki](https://bitlife-life-simulator.fandom.com/wiki/Ribbons)
  - [Bitizenship wiki](https://bitlife-life-simulator.fandom.com/wiki/Bitizenship)
  - [App Store reviews](https://apps.apple.com/hu/app/1374403536?see-all=reviews&platform=iphone)
  - [Reddit on paywalls](https://www.reddit.com/r/bitlife/comments/1kn61kr/is_bitcitizen_and_god_mode_worth_buying/)
  - [Yahoo Tech, presidency guide](https://tech.yahoo.com/gaming/articles/become-president-bitlife-003516126.html)
  - [Reddit, presidency guide](https://www.reddit.com/r/BitLifeApp/comments/1j49bph/how_to_become_president_100_guide/)
- Hay Day:
  - [Wikipedia](https://en.wikipedia.org/wiki/Hay_Day)
  - [Roadside Shop wiki](https://hayday.fandom.com/wiki/Roadside_Shop)
  - [Experience Levels wiki](https://hayday.fandom.com/wiki/Experience_Levels)
  - [Reddit starter guide](https://www.reddit.com/r/HayDay/comments/1jmcare/everything_i_wish_i_knew_starting_out_in_hayday/)
- Township:
  - [Regatta wiki](https://township.fandom.com/wiki/Regatta)
  - [App Store reviews](https://apps.apple.com/us/app/township/id638689075?see-all=reviews)
  - [Reddit on Regatta rules](https://www.reddit.com/r/TownshipGame/comments/1cxnuf4/regatta_question/)
  - [Facebook group on economy changes](https://www.facebook.com/groups/3154528861433972/posts/4506039289616249/)
- Clash of Clans:
  - [Wikipedia](https://en.wikipedia.org/wiki/Clash_of_Clans)
  - [Deconstructor of Fun on the Builder Base](https://www.deconstructoroffun.com/blog/2017/6/18/the-good-bad-ugly-of-clash-of-clans-builder-base)
  - [Supercell, Dec 2023 reductions](https://supercell.com/en/games/clashofclans/blog/news/cost-and-time-reductions-december-2023)
  - [Supercell, Apr 2026 reductions](https://supercell.com/en/games/clashofclans/blog/release-notes/the-sound-of-clash-update)
- SimCity BuildIt:
  - [TouchArcade review](https://toucharcade.com/2014/12/23/simcity-buildit-review/)
  - [r/SCBuildIt on time](https://www.reddit.com/r/SCBuildIt/comments/nrxu7i/does_anyone_feel_this_game_requires_too_much_time/)
- Pocket City:
  - [Official info page](https://pocketcitygame.com/info.html)
  - [ResetEra, Pocket City 2](https://www.resetera.com/threads/pocket-city-2-cool-looking-city-builder-where-you-can-explore-and-do-quests-inside-your-city-as-you-build-summer-2023-mobile-no-mtx.700462/)
  - [Pocket City 2 App Store reviews](https://apps.apple.com/us/app/pocket-city-2/id1533709428?see-all=reviews)
- Cities: Skylines: [Wikipedia](https://en.wikipedia.org/wiki/Cities:_Skylines)
- Tropico 6: [Wikipedia](https://en.wikipedia.org/wiki/Tropico_6)
- Democracy:
  - [Wikipedia](https://en.wikipedia.org/wiki/Democracy_(video_game))
  - [Democracy 3 on Steam](https://store.steampowered.com/app/245470/)
- Animal Crossing:
  - [Nintendo support, dream islands](https://www.nintendo.com/en-gb/Support/Purchases-Subscriptions/Games/How-to-Visit-Another-Player-s-Dream-Island-Animal-Crossing-New-Horizons--1821306.html)
  - [AOEAH, dream updates](https://www.aoeah.com/news/4331--acnh-30-dream-islands-guide--new-dream-addresses)
  - [Reddit on visitor restrictions](https://www.reddit.com/r/AnimalCrossing/comments/frw9zl/whats_the_worst_thing_visitors_can_do_to_your/)
  - [Washington Post etiquette guide](https://www.washingtonpost.com/video-games/2020/04/06/animal-crossing-etiquette-guide-dos-donts-online-multiplayer/)
- Stardew Valley:
  - [Day Cycle wiki](https://stardewvalleywiki.com/Day_Cycle)
  - [Bundles wiki](https://stardewvalleywiki.com/Bundles)
  - [GamesRadar on fishing](https://www.gamesradar.com/games/simulation/concernedape-regrets-making-stardew-valleys-fishing-minigame-too-hard-when-you-start-out-but-still-thinks-its-good-overall-i-know-its-controversial/)
  - [Polygon on fishing](https://www.polygon.com/gaming/24118191/stardew-valley-fishing-defense/)
- The Sims 4: [Wikipedia](https://en.wikipedia.org/wiki/The_Sims_4)
- Papers, Please: [Wikipedia](https://en.wikipedia.org/wiki/Papers,_Please)
- Not Tonight: [Wikipedia](https://en.wikipedia.org/wiki/Not_Tonight_(video_game))
- Two Point Hospital: [Wikipedia](https://en.wikipedia.org/wiki/Two_Point_Hospital)
- Politics and career games:
  - [Reigns (Wikipedia)](https://en.wikipedia.org/wiki/Reigns_(video_game))
  - [Suzerain review, Third Coast Review](https://thirdcoastreview.com/games-tech/2020/12/03/game-review-suzerain)
  - [Suzerain on IFDB](https://ifdb.org/viewgame?id=z4ux1h8f8hr5uaw3)
  - [Suzerain player review, Reddit](https://www.reddit.com/r/suzerain/comments/1qokm7k/my_personal_review_of_the_game_for_sordland/)
  - [President: Simulator Game on Google Play](https://play.google.com/store/apps/details?id=com.hiddenlake.president)
- Async play and moderation:
  - [Death Stranding likes, EconSquawk](https://econsquawk.substack.com/p/the-ingenuity-of-death-strandings)
  - [Dark Souls messages, Bad at Sports](https://badatsports.com/2013/praise-the-sun-the-contextual-language-of-dark-souls/)
  - [r/gamedesign on Souls messages](https://www.reddit.com/r/gamedesign/comments/1cgcozl/seriously_why_does_the_soulslike_message_system/)
  - [r/gamedev on cheating](https://www.reddit.com/r/gamedev/comments/hbweuh/how_to_minimize_cheating_in_a_multiplayer_game/)
  - [Ostorlab on mobile game security](https://blog.ostorlab.co/mobile-game-security.html)
  - [GameMaker forum on leaderboards](https://forum.gamemaker.io/index.php?threads/mobile-game-with-leaderboards-how-to-handle-cheating.122245/)
  - [GamesIndustry.biz on FarmVille](https://www.gamesindustry.biz/new-facebook-rules-cause-drop-in-gamer-numbers)
- Meta layers, onboarding and benchmarks:
  - [GameRefinery, match-3 meta layer](https://www.gamerefinery.com/casual-match3-meta-layer-new-winning-formula/)
  - [Udonis, FTUE](https://www.blog.udonis.co/mobile-marketing/mobile-games/first-time-user-experience)
  - [GameAnalytics 2026 benchmarks](https://www.gameanalytics.com/reports/2026-mobile-pc-gaming-benchmarks)
  - [GameDev Reports, GameAnalytics Q1 2024](https://gamedevreports.substack.com/p/gameanalytics-benchmarks-in-mobile)
- Dungeon Keeper (2014): [Wikipedia](https://en.wikipedia.org/wiki/Dungeon_Keeper_(2014_video_game))
- Our own: [brick-by-brick/docs/RESEARCH.md](../../../brick-by-brick/docs/RESEARCH.md)
