import {
  characterSkillModalRoot,
  characterContentEl,
  homeJourneyContentEl,
  journeyContentEl,
  journeyEventBodyEl,
  journeyEventMetaEl,
  journeyEventModal,
  journeyEventTitleEl,
  journeyHistoryBodyEl,
  journeyHistoryEyebrowEl,
  journeyHistoryMetaEl,
  journeyHistoryModal,
  journeyHistoryTitleEl,
  journeyOutcomeBodyEl,
  journeyOutcomeMetaEl,
  journeyOutcomeModal,
  journeyOutcomeTitleEl,
} from "../../core/dom.js";
import {
  JOURNEY_BASE_CLASS,
  JOURNEY_CLASS_META,
  JOURNEY_STAT_KEYS,
  JOURNEY_STAT_META,
  JOURNEY_STORY_XP_PER_LEVEL,
} from "../../core/constants.js";
import {
  clamp,
  escapeAttribute,
  escapeHtml,
  formatDateTime,
} from "../../core/formatters.js";
import { getCurrentLocale, t } from "../../core/i18n.js";
import { appState } from "../../core/state.js";
import { syncBodyScrollLock } from "../../core/ui.js";
import {
  buildJourneyDerived,
  getJourneyBagMeta,
  buildJourneyStretchPresentation,
  buildJourneySupplies,
  formatDurationMs,
  formatDurationRangeHours,
  getJourneyActivityText,
  getJourneyBoss,
  getJourneyLevel,
  getJourneyPendingWeapons,
  getJourneySegmentProgress,
  getJourneyStatusLabel,
  getJourneyStoryLevelBonus,
  getJourneyWeaponInventory,
  getJourneyZoneName,
  getRecoveryText,
  getUnspentSkillPoints,
} from "./journeyEngine.js";

const JOURNEY_WALK_SPRITE = {
  src: "./assets/journey/sprites/Walking.png",
  frameCount: 12,
  frameDurationMs: 100,
  maxDisplayWidth: 136,
  maxDisplayHeight: 168,
};

const JOURNEY_INJURED_SPRITE = {
  src: "./assets/journey/sprites/injured.png",
  frameCount: 12,
  frameDurationMs: 100,
  maxDisplayWidth: 136,
  maxDisplayHeight: 168,
};

const JOURNEY_ATTACK_SPRITE = {
  src: "./assets/journey/sprites/Attack.png",
  frameCount: 12,
  frameDurationMs: 100,
  maxDisplayWidth: 156,
  maxDisplayHeight: 184,
};

const JOURNEY_BERRY_SPRITE = {
  src: "./assets/journey/sprites/Berry.png",
  frameCount: 12,
  frameDurationMs: 100,
  maxDisplayWidth: 156,
  maxDisplayHeight: 184,
};

const JOURNEY_PORTRAIT_SPRITE = {
  src: "./assets/journey/sprites/Idlethink.png",
  frameCount: 12,
  frameDurationMs: 100,
  maxDisplayWidth: 176,
  maxDisplayHeight: 220,
};

const JOURNEY_BATTLE_ART = {
  0: {
    src: "./assets/journey/images/Boarimage.png",
    alt: "Cornered Forest Boar",
  },
};

const JOURNEY_LOCALIZED_META = {
  ja: {
    classes: {
      stranded: {
        label: "弱くて転移したばかり",
        description:
          "訓練も地図も、まともな装備もほとんどないまま異世界で目を覚ました。",
      },
      warrior: {
        label: "喧嘩屋",
        description:
          "泥臭く戦い、衝撃に耐え、近距離の乱戦を生き延びる術を覚えた。",
      },
      mage: {
        label: "野の魔術師",
        description:
          "世界が少しずつ静かではなくなる。奇妙な流れを感じ取り、それを扱い始める。",
      },
      thief: {
        label: "斥候",
        description:
          "身軽さ、早めの察知、無駄のなさで生き残る。",
      },
    },
    stats: {
      might: {
        label: "筋力",
        help: "荒っぽい戦い、重量物の扱い、頼りない武器を使いこなす助けになる。",
      },
      finesse: {
        label: "技巧",
        help: "身のこなしが速く静かになり、危険な場面で捕まりにくくなる。",
      },
      arcana: {
        label: "秘術",
        help: "この世界の奇妙な理を感じ取り、やがて扱えるようになる。",
      },
      vitality: {
        label: "生命力",
        help: "より長く立っていられ、痛い失敗のあとも立て直しやすくなる。",
      },
      resolve: {
        label: "意志",
        help: "落ち着きを保ち、乏しい食事を引き延ばし、消耗しても進み続けやすくなる。",
      },
    },
    bags: {
      none: {
        label: "袋なし",
        description: "腰と両手に収まるものしか持てない。",
      },
      satchel: {
        label: "採集用サッチェル",
        description: "その日暮らしを抜け出すには十分なくらいの小さな肩掛け袋。",
      },
      backpack: {
        label: "旅人のバックパック",
        description: "予備装備を持ち歩いても足元がおぼつかなくならない、まともな鞄。",
      },
      field_kit: {
        label: "遠征用フィールドキット",
        description: "より長く厳しい道に備えた、補強入りの整理された背嚢。",
      },
    },
    weapons: {
      scavenged_weapon: {
        label: "拾い物の武器",
        tier: "即席",
        description: "素手よりはましだが、本当にそれだけだ。",
      },
      rust_worn_belt_knife: {
        label: "錆びたベルトナイフ",
        tier: "一般",
        description: "間合いは短いが、手が速く、空のポケットよりはずっといい。",
      },
      crude_spear_club: {
        label: "粗末な槍棍",
        tier: "一般",
        description: "不格好で重いが、いざという時には意外と頼れる。",
      },
      weathered_short_sword: {
        label: "使い古しの短剣",
        tier: "上質",
        description: "釣り合いが良く、綺麗に戦える感覚を少しだけくれる。",
      },
      hardened_boar_spear: {
        label: "硬化した猪槍",
        tier: "上質",
        description: "止まるべき時に止まらない相手を狩るための槍。",
      },
      travelers_hatchet: {
        label: "旅人の手斧",
        tier: "上質",
        description: "野営でも役立ち、喧嘩でも妙に頼りになる。",
      },
      bandit_cut_machete: {
        label: "山賊削りの鉈",
        tier: "上質",
        description: "粗い鋼だが、攻め気と素早い手に応えてくれる。",
      },
      ashwood_bow: {
        label: "アッシュウッドの弓",
        tier: "希少",
        description: "軽く、信頼でき、辛抱強い手にはずっと危険だ。",
      },
      ember_rod: {
        label: "残り火のロッド",
        tier: "希少",
        description: "熱の記憶をまだ宿した、焦げた焦点具。",
      },
      warded_stave: {
        label: "護符の杖",
        tier: "希少",
        description: "見た目以上に安定していて、防護の刻印を抱えている。",
      },
      ruin_greatblade: {
        label: "遺跡の大剣",
        tier: "英雄級",
        description: "より苛烈な道を通ってきた重鋼。",
      },
    },
    starterItems: {
      "dead phone": "電池切れのスマホ",
      "cheap wristwatch": "安物の腕時計",
      "school backpack": "学生用バックパック",
      "blunt pocket knife": "切れ味の悪い折りたたみナイフ",
      "lucky coin": "お守りのコイン",
      "cracked lighter": "ひび割れたライター",
      "old notebook": "古いノート",
    },
    eventTitles: {
      "Unknown Forest": "未知の森",
      "Creekside Thicket": "小川沿いの茂み",
      "Abandoned Footpath": "打ち捨てられた細道",
      "Fallow Hamlet Outskirts": "寂れた集落外れ",
      "Broken Watchroad": "壊れた監視街道",
      "Fog Marsh Crossing": "霧沼の渡り",
      "Stonepass Trail": "石路峠道",
      "Old Frontier Road": "旧辺境街道",
      "Split Pine Ravine": "裂け松の谷",
      "Sunken Causeway": "沈んだ土手道",
      "Briar Tollway": "いばらの関道",
      "Lantern Mile": "灯籠街道",
      "Ashen Switchback": "灰の九十九折り",
      "Ruined Gate Approach": "廃門前街道",
      "Cornered Forest Boar": "追い詰められた森猪",
      "Hungry Wolf Pack": "飢えた狼の群れ",
      "Bridge Ambusher": "橋の伏兵",
      "Marshfang Lurker": "沼牙の潜伏者",
      "Hill Band Captain": "丘賊の頭目",
      "Ruin-Stalker": "遺跡の追跡者",
      "Gravepath Ogre": "墓道のオーガ",
      "Storm Ridge Wyrm": "嵐尾根のワーム",
      "The Border Tyrant": "境界の暴君",
      "Tollroad Reaver": "関道の略奪者",
      "Mireglass Serpent": "泥鏡の蛇",
      "Blackbriar Stag": "黒い茨角の鹿",
      "Gatehouse Revenant": "門楼の亡霊",
      "Ashfall Chimera": "灰降りのキメラ",
      "Forced retreat": "強制撤退",
      "A road healer finds you": "街道の治療師に見つかる",
      "A traveling herbalist waves you over": "旅の薬草師が手招きする",
      "A glowing spring in the underbrush": "藪の中で光る泉",
      "A raider's camp by the looted carriage": "略奪された荷車のそばの賊の野営地",
      "A broken cart in the brush": "茂みに埋もれた壊れた荷車",
      "A patch of unfamiliar berries": "見慣れない木の実の群れ",
      "Heavy tracks near the creek": "小川のそばに重い足跡",
      "A collapsed watchtower in the reeds": "葦原に崩れた見張り塔",
      "A torn satchel caught in the briars": "いばらに引っかかった破れた鞄",
      "Cold rain before dusk": "夕暮れ前の冷たい雨",
      "An abandoned pack frame by the road": "道ばたの打ち捨てられた背負子",
      "A sealed supply niche in a ruined gate": "崩れた門に残る封印補給庫",
      "A waystone with a hidden compartment": "隠し収納のある道標石",
      "A guard by a roadside fire": "道ばたの火のそばの衛兵",
      "A whispering shrine": "ささやく祠",
      "A quiet forager on the trail": "道で見かけた静かな採集者",
      "Smoke from a charcoal pit": "炭焼き窯から立つ煙",
      "A rope ferry over black water": "黒い水を渡る縄の渡し",
      "Lanterns hung for the dead": "死者のために吊るされた灯",
      "The Last Hearth Below the Hill": "丘の下の最後の炉火",
      "Brand of the Last Hearth": "最後の炉火の刻印",
      "Ash-Marrow Vigor": "灰髄の活力",
      "Cinder-Script Memory": "残り火の記憶文",
      "An oath-cairn of the first wardens": "最初の守人たちの誓石",
      "Warden's Burden": "守人の重荷",
      "Step of the First Scout": "最初の斥候の歩み",
      "Witness of the Wardens": "守人たちの証人",
      "The mirror spring under moonlight": "月光の下の鏡泉",
      "Moon-Glass Insight": "月鏡の洞察",
      "Stillwater Footing": "止水の足場",
      "Star-Cooled Blood": "星冷えの血",
    },
  },
};

const JOURNEY_LOG_TRANSLATIONS_JA = {
  "A passing traveler shared dried meat and better directions after seeing the state you were in.":
    "通りすがりの旅人が、こちらの有り様を見て干し肉と少しまともな道案内を分けてくれた。",
  "You spent half an hour convincing yourself the strange sky was real.":
    "見慣れない空が本物だと自分に言い聞かせるだけで、三十分ほどかかった。",
  "You followed a game trail, lost it, and had to start over from scratch.":
    "獣道を追ったものの見失い、最初からやり直す羽目になった。",
  "Every snapping twig sounded like a monster until you realized some were only rabbits.":
    "折れる枝の音が全部魔物に聞こえたが、そのいくつかはただの兎だった。",
  "You tested bark, roots, and berries with the caution of someone who badly wants to stay alive.":
    "どうしても生き延びたい人間らしく、樹皮や根や木の実を慎重に確かめた。",
  "You stopped twice just to make sure the distant bells were real and not your imagination.":
    "遠くの鐘が幻聴ではないと確かめるためだけに、二度も立ち止まった。",
  "A patch of flattened grass became a landmark simply because you were desperate for anything familiar.":
    "見慣れたものが何でも欲しくて、踏み潰された草地ですら目印になった。",
  "You found a flatter patch of ground and counted that as shelter.":
    "少し平らな地面を見つけ、それをひとまずの寝場所とした。",
  "A stream saved the day, even if the water tasted like leaves and mud.":
    "水が葉と泥の味でも、小川が今日は命を繋いでくれた。",
  "You practised gripping your makeshift weapon until your hands stopped shaking.":
    "手の震えが止まるまで、間に合わせの武器の握り方を何度も確かめた。",
  "You learned the hard way that panic wastes more energy than walking does.":
    "焦りは歩くこと以上に体力を削ると、痛い形で思い知った。",
  "You spotted old cut marks on a tree and followed them longer than you care to admit.":
    "木に残った古い刻み傷を見つけて、思った以上に長くそれを辿ってしまった。",
  "A stretch of quiet road felt more threatening than the things that usually announce themselves.":
    "妙に静かな道は、気配を隠さない連中よりもかえって不気味だった。",
  "A distant chimney reminded you civilization exists somewhere beyond the trees.":
    "遠くの煙突を見て、木々の向こうにまだ人の営みがあると思い出した。",
  "You moved slower today, but you chose the safer trail and kept your footing.":
    "今日は歩みが遅くても、より安全な道を選んで足元を守れた。",
  "You caught yourself scanning every hedgerow before committing to the road.":
    "道に踏み出す前に、生け垣のひとつひとつを無意識に確認していた。",
  "You are not comfortable out here yet, but you are no longer completely helpless.":
    "まだここが落ち着く場所ではないが、もう完全に無力というわけでもない。",
  "An old milestone told you someone once believed this road could be civilized.":
    "古い里程標が、この道もかつてはまともになり得ると誰かが信じていたことを教えてくれた。",
  "You crossed a stretch of road that had been cleared recently enough to make you suspicious.":
    "つい最近まで誰かが手入れしていたような道を渡り、かえって警戒が強まった。",
  "You found wagon ruts deep enough to promise trade, trouble, or both.":
    "荷車の轍は深く、交易か厄介事か、その両方を予感させた。",
};

const JOURNEY_SPRITE_BOUNDING_PADDING = 12;
const JOURNEY_SPRITE_BACKGROUND_TOLERANCE = 24;
const JOURNEY_SPRITE_ALPHA_THRESHOLD = 12;
const journeySpriteMetricsCache = new Map();

function getJourneyLocalizedEntry(group, key, field, fallback = "") {
  const locale = getCurrentLocale();
  return JOURNEY_LOCALIZED_META[locale]?.[group]?.[key]?.[field] || fallback;
}

function getJourneyClassLabel(classKey) {
  return getJourneyLocalizedEntry(
    "classes",
    classKey,
    "label",
    JOURNEY_CLASS_META[classKey]?.label || ""
  );
}

function getJourneyClassDescription(classKey) {
  return getJourneyLocalizedEntry(
    "classes",
    classKey,
    "description",
    JOURNEY_CLASS_META[classKey]?.description || ""
  );
}

function getJourneyStatLabel(statKey) {
  return getJourneyLocalizedEntry(
    "stats",
    statKey,
    "label",
    JOURNEY_STAT_META[statKey]?.label || statKey
  );
}

function getJourneyStatHelp(statKey) {
  return getJourneyLocalizedEntry(
    "stats",
    statKey,
    "help",
    JOURNEY_STAT_META[statKey]?.help || ""
  );
}

function getJourneyBagLabel(bagKey, fallback = "") {
  return getJourneyLocalizedEntry("bags", bagKey, "label", fallback);
}

function getJourneyBagDescription(bagKey, fallback = "") {
  return getJourneyLocalizedEntry("bags", bagKey, "description", fallback);
}

function getJourneyWeaponLabel(weaponKey, fallback = "") {
  return getJourneyLocalizedEntry("weapons", weaponKey, "label", fallback);
}

function getJourneyWeaponDescription(weaponKey, fallback = "") {
  return getJourneyLocalizedEntry("weapons", weaponKey, "description", fallback);
}

function getJourneyWeaponTier(weaponKey, fallback = "") {
  return getJourneyLocalizedEntry("weapons", weaponKey, "tier", fallback);
}

function getJourneyStarterItemLabel(item) {
  return JOURNEY_LOCALIZED_META[getCurrentLocale()]?.starterItems?.[item] || item;
}

function getJourneyEventTitle(title) {
  return JOURNEY_LOCALIZED_META[getCurrentLocale()]?.eventTitles?.[title] || title;
}

function getJourneyLogText(text) {
  if (getCurrentLocale() !== "ja") {
    return text;
  }

  return JOURNEY_LOG_TRANSLATIONS_JA[text] || text;
}

function buildJourneyProgressDisplay({
  state,
  progress,
  stretchPresentation,
  journeyStats,
}) {
  if (state.status === "recovering") {
    return buildJourneyRecoveryProgressDisplay(state);
  }

  return {
    widthPercent: progress.percent,
    trackClassName: "",
    fillClassName: "",
    currentLabel: stretchPresentation.currentLabel,
    remainingLabel: stretchPresentation.remainingLabel,
    motionClassName: getJourneyProgressMotionClass(journeyStats.speedPerHour),
    chevronCount: journeyStats.speedPerHour >= 3.8 ? 2 : 1,
  };
}

function buildJourneyRecoveryProgressDisplay(state) {
  const nowMs = Date.now();
  const recoveryStartMs = state.recoveryStartedAt
    ? new Date(state.recoveryStartedAt).getTime()
    : null;
  const recoveryEndMs = state.restUntil ? new Date(state.restUntil).getTime() : null;
  const totalMs =
    recoveryStartMs && recoveryEndMs && recoveryEndMs > recoveryStartMs
      ? recoveryEndMs - recoveryStartMs
      : 0;
  const remainingMs = recoveryEndMs ? Math.max(0, recoveryEndMs - nowMs) : 0;
  const elapsedMs = totalMs ? Math.max(0, totalMs - remainingMs) : 0;
  const widthPercent = totalMs
    ? clamp((elapsedMs / totalMs) * 100, 6, 100)
    : 24;

  return {
    widthPercent,
    trackClassName: "is-recovery",
    fillClassName: "is-recovery",
    currentLabel: t("journeyUi.progress.recoveryTimeLeft", {
      value: formatDurationMs(remainingMs),
    }),
    remainingLabel:
      state.recoveryObjective || t("journeyUi.progress.recoveryInProgress"),
    motionClassName: "pace-slow",
    chevronCount: 1,
  };
}

function getJourneyProgressMotionClass(speedPerHour) {
  if (!Number.isFinite(speedPerHour) || speedPerHour < 3.6) {
    return "pace-slow";
  }

  if (speedPerHour < 4.5) {
    return "pace-steady";
  }

  return "pace-fast";
}

function renderJourneyProgressDisplay(progressDisplay) {
  const chevrons = Array.from({ length: progressDisplay.chevronCount }, (_, index) => {
    const delayMs = index * 180;
    return `<span class="journey-progress-chevron" style="animation-delay: ${delayMs}ms;">&gt;</span>`;
  }).join("");

  return `
    <div class="journey-progress-track ${escapeAttribute(progressDisplay.trackClassName || "")}">
      <div
        class="journey-progress-fill ${escapeAttribute(progressDisplay.fillClassName || "")}"
        style="width: ${progressDisplay.widthPercent}%"
      ></div>
      <div
        class="journey-progress-flow ${escapeAttribute(progressDisplay.motionClassName || "pace-slow")}"
        aria-hidden="true"
      >
        ${chevrons}
      </div>
    </div>

    <div class="journey-progress-meta">
      <span>${escapeHtml(progressDisplay.currentLabel)}</span>
      <span>${escapeHtml(progressDisplay.remainingLabel)}</span>
    </div>
  `;
}

export function renderHomeJourney(state, xpSummary, supplies) {
  if (!homeJourneyContentEl) return;

  const journeyLevel = getJourneyLevel(state, xpSummary.level);
  const journeyStats = buildJourneyDerived(state, journeyLevel);
  const boss = getJourneyBoss(state.bossIndex);
  const progress = getJourneySegmentProgress(state.totalDistance, state.bossIndex);
  const stretchPresentation = buildJourneyStretchPresentation(
    state,
    boss,
    progress,
    journeyStats,
    supplies
  );
  const hpPercent = clamp((state.currentHp / journeyStats.maxHp) * 100, 0, 100);
  const hungerPercent = clamp(
    (state.currentHunger / journeyStats.maxHunger) * 100,
    0,
    100
  );
  const pendingEvent = state.pendingEvents[0] || null;
  const displayName = getJourneyDisplayName(state);
  const stretchSprite = getJourneyStretchSprite(state, hpPercent, hungerPercent);
  const progressDisplay = buildJourneyProgressDisplay({
    state,
    progress,
    stretchPresentation,
    journeyStats,
  });

  homeJourneyContentEl.innerHTML = `
    <div class="journey-home-shell">
      <div class="journey-home-top">
        <div class="journey-home-copy">
          <p class="eyebrow">${escapeHtml(t("journeyUi.home.atGlance"))}</p>
          <h2>${escapeHtml(displayName)}</h2>
          <p class="muted-text">
            ${escapeHtml(getJourneyActivityText(state, boss, progress, journeyStats, supplies))}
          </p>

          ${renderJourneySpriteBanner(stretchSprite.sprite, {
            wrapperClass: "journey-home-sprite-banner",
            stageClass: "journey-sprite-stage-banner",
            label: stretchSprite.label,
          })}

          ${renderJourneyProgressDisplay(progressDisplay)}

          <div class="summary-row">
            <span class="summary-pill">${escapeHtml(t("journeyUi.home.currentGoal"))}: ${escapeHtml(
              stretchPresentation.goalTitle
            )}</span>
            <span class="summary-pill">${escapeHtml(
              stretchPresentation.horizonLabel
            )}: ${escapeHtml(stretchPresentation.horizonValue)}</span>
          </div>
        </div>

        <div class="journey-home-meters">
          <div>
            <p class="journey-overline">${escapeHtml(t("journeyUi.home.condition"))}</p>
            <h3>Lv. ${journeyLevel} ${escapeHtml(
              getJourneyClassLabel(state.classType)
            )}</h3>
            <p class="journey-inline-copy">
              ${escapeHtml(
                getCurrentLocale() === "ja"
                  ? `${getJourneyStatusLabel(state.status)} • 体力 ${Math.round(
                      hpPercent
                    )}% • 空腹 ${Math.round(hungerPercent)}%`
                  : `${getJourneyStatusLabel(state.status)} • ${Math.round(
                      hpPercent
                    )}% health • ${Math.round(hungerPercent)}% hunger`
              )}
            </p>
          </div>

          <div class="journey-home-meter">
            <div class="resource-meta">
              <span>${escapeHtml(t("journeyUi.common.health"))}</span>
              <span>${Math.round(state.currentHp)} / ${journeyStats.maxHp}</span>
            </div>
            <div class="resource-track">
              <div class="resource-fill resource-fill-health" style="width: ${hpPercent}%"></div>
            </div>
          </div>

          <div class="journey-home-meter">
            <div class="resource-meta">
              <span>${escapeHtml(t("journeyUi.common.hunger"))}</span>
              <span>${Math.round(state.currentHunger)} / ${journeyStats.maxHunger}</span>
            </div>
            <div class="resource-track">
              <div class="resource-fill resource-fill-hunger" style="width: ${hungerPercent}%"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="journey-home-actions">
        <button type="button" class="secondary-button" data-home-action="open-journey">
          ${escapeHtml(t("journeyUi.home.openJourney"))}
        </button>
        ${
          pendingEvent
            ? `
              <button
                type="button"
                class="primary-button journey-home-event-button"
                data-home-action="open-event"
                data-event-id="${pendingEvent.id}"
              >
                <span class="journey-event-kicker">${escapeHtml(
                  t("journeyUi.home.newEvent")
                )}</span>
                <span class="journey-home-event-title">${escapeHtml(
                  getJourneyEventTitle(pendingEvent.title)
                )}</span>
              </button>
            `
            : ""
        }
      </div>
    </div>
  `;
}

export function openJourneyEventModal(eventEntry) {
  if (!journeyEventModal || !journeyEventBodyEl || !journeyEventTitleEl || !journeyEventMetaEl) {
    return;
  }

  journeyEventTitleEl.textContent = getJourneyEventTitle(eventEntry.title);
  journeyEventMetaEl.textContent = `${formatDateTime(eventEntry.createdAt)} • ${eventEntry.teaser}`;
  journeyEventBodyEl.innerHTML = `
    ${renderJourneyEventPanel(eventEntry)}

    <div class="journey-event-choice-list">
      ${eventEntry.choices
        .map(
          (choice) => `
            <button
              type="button"
              class="secondary-button journey-event-choice"
              data-journey-event-choice="resolve"
              data-event-id="${eventEntry.id}"
              data-choice-id="${choice.id}"
            >
              <span class="journey-event-choice-title">${renderJourneyChoiceLabel(
                choice
              )}</span>
              <span class="journey-event-choice-preview">${escapeHtml(
                choice.preview
              )}</span>
            </button>
          `
        )
        .join("")}
    </div>
  `;

  journeyEventModal.hidden = false;
  syncBodyScrollLock();
}

export function closeJourneyEventModal() {
  if (!journeyEventModal) return;
  journeyEventModal.hidden = true;
  if (journeyEventBodyEl) journeyEventBodyEl.innerHTML = "";
  syncBodyScrollLock();
}

export function showJourneyEventThinking(choiceLabel) {
  if (!journeyEventBodyEl) return;

  const choiceButtons = journeyEventBodyEl.querySelectorAll(".journey-event-choice");
  for (const button of choiceButtons) {
    if (button instanceof HTMLButtonElement) {
      button.disabled = true;
    }
  }

  if (journeyEventBodyEl.querySelector(".journey-event-thinking")) {
    return;
  }

  journeyEventBodyEl.insertAdjacentHTML(
    "beforeend",
    `
      <div class="journey-event-thinking" aria-live="polite">
        <span class="journey-event-thinking-title">${escapeHtml(
          choiceLabel || t("journeyUi.modals.thinkingTitle")
        )}</span>
        <span class="journey-event-thinking-copy">${escapeHtml(
          t("journeyUi.modals.thinkingCopy")
        )}</span>
        <span class="journey-event-thinking-dots" aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
      </div>
    `
  );
}

function renderJourneyChoiceLabel(choice) {
  const label = String(choice?.label || t("journeyUi.modals.choose"));
  const highlightWord = String(choice?.highlightWord || "").trim();

  if (!highlightWord) {
    return escapeHtml(label);
  }

  const labelLower = label.toLowerCase();
  const highlightLower = highlightWord.toLowerCase();
  const highlightStart = labelLower.indexOf(highlightLower);

  if (highlightStart === -1) {
    return escapeHtml(label);
  }

  const highlightEnd = highlightStart + highlightWord.length;
  return `${escapeHtml(label.slice(0, highlightStart))}<span class="journey-event-choice-highlight">${escapeHtml(
    label.slice(highlightStart, highlightEnd)
  )}</span>${escapeHtml(label.slice(highlightEnd))}`;
}

export function openJourneyOutcomeModal(eventEntry, choice, resolution, outcomeItems) {
  if (
    !journeyOutcomeModal ||
    !journeyOutcomeBodyEl ||
    !journeyOutcomeTitleEl ||
    !journeyOutcomeMetaEl
  ) {
    return;
  }

  const showRollSummary = resolution?.showRollSummary !== false;
  journeyOutcomeTitleEl.textContent = getJourneyEventTitle(
    eventEntry?.title || t("journeyUi.modals.whatHappenedNext")
  );
  journeyOutcomeMetaEl.textContent = resolution
    ? resolution.outcomeMeta
      ? resolution.outcomeMeta
      : showRollSummary
      ? `${resolution.success ? t("journeyUi.modals.succeeded") : t("journeyUi.modals.failed")} • ${resolution.statLabel} • ${t("journeyUi.modals.chance", {
          value: resolution.successPercent,
        })}`
      : t("journeyUi.modals.roadAnswered")
    : choice?.label
      ? t("journeyUi.modals.youChose", { label: choice.label })
      : t("journeyUi.modals.roadAnswered");
  journeyOutcomeBodyEl.innerHTML = `
    <div class="journey-event-panel journey-outcome-panel">
      ${
        resolution && showRollSummary
          ? `
            <div class="journey-outcome-summary">
              <span class="journey-outcome-result ${escapeAttribute(
                resolution.success ? "is-success" : "is-failure"
              )}">
                ${escapeHtml(
                  resolution.success
                    ? t("journeyUi.modals.succeeded")
                    : t("journeyUi.modals.failed")
                )}
              </span>
              <p class="journey-outcome-meta-copy">
                ${escapeHtml(
                  `Used ${resolution.statLabel} ${resolution.statValue} against a ${resolution.successPercent}% chance.`
                )}
              </p>
            </div>
          `
          : ""
      }
      ${
        choice && showRollSummary
          ? `
            <p class="journey-outcome-choice-copy">
              ${escapeHtml(t("journeyUi.modals.triedPrefix"))}
              <span class="journey-outcome-choice-text">${renderJourneyChoiceLabel(
                choice
              )}</span>
            </p>
          `
          : ""
      }
      <p>${escapeHtml(resolution?.resultText || t("journeyUi.modals.roadAnswered"))}</p>
      ${
        outcomeItems.length
          ? `
            <div class="journey-outcome-pill-row">
              ${outcomeItems
                .map(
                  (item) => `
                    <span class="journey-outcome-pill ${escapeAttribute(
                      item.className
                    )}">${escapeHtml(item.label)}</span>
                  `
                )
                .join("")}
            </div>
          `
          : `<p class="muted-text">${escapeHtml(
              t("journeyUi.modals.noVisibleChange")
            )}</p>`
      }
    </div>
  `;

  journeyOutcomeModal.hidden = false;
  syncBodyScrollLock();
}

export function closeJourneyOutcomeModal() {
  if (!journeyOutcomeModal) return;
  journeyOutcomeModal.hidden = true;
  if (journeyOutcomeBodyEl) journeyOutcomeBodyEl.innerHTML = "";
  syncBodyScrollLock();
}

export function openJourneyHistoryModal({
  eyebrow = t("journeyUi.modals.historyEyebrow"),
  title = t("journeyUi.modals.historyTitle"),
  meta = t("journeyUi.modals.historyMeta"),
  entries = [],
  emptyTitle = t("journeyUi.modals.historyEmptyTitle"),
  emptyBody = t("journeyUi.modals.historyEmptyBody"),
} = {}) {
  if (
    !journeyHistoryModal ||
    !journeyHistoryBodyEl ||
    !journeyHistoryTitleEl ||
    !journeyHistoryMetaEl ||
    !journeyHistoryEyebrowEl
  ) {
    return;
  }

  journeyHistoryEyebrowEl.textContent = eyebrow;
  journeyHistoryTitleEl.textContent = title;
  journeyHistoryMetaEl.textContent = meta;
  journeyHistoryBodyEl.innerHTML = entries.length
    ? `
        <div class="journey-history-list">
          ${entries
            .map(
              (entry) => `
                <article class="journey-history-entry">
                  <div class="journey-history-entry-head">
                    <div>
                      <p class="journey-history-entry-kicker">${escapeHtml(
                        entry.kicker || eyebrow
                      )}</p>
                      <h4>${escapeHtml(
                        getJourneyEventTitle(entry.title || t("journeyUi.modals.untitledEntry"))
                      )}</h4>
                    </div>
                    <time class="journey-history-entry-time">${formatDateTime(
                      entry.at
                    )}</time>
                  </div>
                  ${
                    entry.detail
                      ? `<p class="journey-history-entry-copy">${escapeHtml(entry.detail)}</p>`
                      : ""
                  }
                </article>
              `
            )
            .join("")}
        </div>
      `
    : `
        <div class="journey-event-panel journey-history-empty">
          <h4>${escapeHtml(emptyTitle)}</h4>
          <p>${escapeHtml(emptyBody)}</p>
        </div>
      `;

  journeyHistoryModal.hidden = false;
  syncBodyScrollLock();
}

export function closeJourneyHistoryModal() {
  if (!journeyHistoryModal) return;
  journeyHistoryModal.hidden = true;
  if (journeyHistoryBodyEl) journeyHistoryBodyEl.innerHTML = "";
  syncBodyScrollLock();
}

export function handleJourneyHistoryModalClick(event) {
  if (!(event.target instanceof HTMLElement)) return;
  if (event.target.closest("[data-close-journey-history]")) {
    closeJourneyHistoryModal();
  }
}

function renderJourneyEventPanel(eventEntry) {
  if (eventEntry?.kind === "boss" && eventEntry.battle) {
    return renderJourneyBossBattlePanel(eventEntry);
  }

  return `
    <div class="journey-event-panel">
      <p>${escapeHtml(eventEntry?.detail || "")}</p>
    </div>
  `;
}

function renderJourneyBossBattlePanel(eventEntry) {
  const battle = eventEntry?.battle;
  if (!battle) {
    return `
      <div class="journey-event-panel">
        <p>${escapeHtml(eventEntry?.detail || "")}</p>
      </div>
    `;
  }

  const bossArt = getJourneyBossBattleArt(battle);
  const loadoutLabel = battle.weaponLabel || "Unarmed";

  return `
    <div class="journey-event-panel journey-battle-panel">
      <div class="journey-battle-overview">
        ${renderJourneyBossBattleArt(battle, bossArt)}
        <div class="journey-battle-status">
          <div class="journey-battle-chip-row">
            <span class="journey-chip is-active">Turn ${battle.turn} / ${battle.maxTurns}</span>
            <span class="journey-chip">${escapeHtml(loadoutLabel)}</span>
          </div>
          ${renderJourneyBossBattleHealthCard({
            label: "Boss",
            name: battle.bossName,
            current: battle.bossHp,
            max: battle.bossMaxHp,
            tone: "boss",
            lastDamage: battle.lastBossDamage,
            damageLabel: "You hit for",
          })}
          ${renderJourneyBossBattleHealthCard({
            label: "You",
            name: "Your health",
            current: battle.heroHp,
            max: battle.heroMaxHp,
            tone: "hero",
            lastDamage: battle.lastHeroDamage,
            damageLabel: "You took",
          })}
        </div>
      </div>
      <div class="journey-battle-copy">
        <p>${escapeHtml(eventEntry.detail)}</p>
      </div>
    </div>
  `;
}

function renderJourneyBossBattleArt(battle, art) {
  if (art?.src) {
    return `
      <div class="journey-battle-art">
        <img
          class="journey-battle-art-image"
          src="${art.src}"
          alt="${escapeAttribute(art.alt || battle.bossName)}"
        />
      </div>
    `;
  }

  return `
    <div class="journey-battle-art is-placeholder">
      <div class="journey-battle-art-placeholder" aria-hidden="true">
        <span class="journey-battle-art-monogram">${escapeHtml(
          getJourneyBattleMonogram(battle.bossName)
        )}</span>
      </div>
      <div class="journey-battle-art-copy">
        <strong>${escapeHtml(battle.bossName)}</strong>
        <span>Boss art placeholder</span>
      </div>
    </div>
  `;
}

function renderJourneyBossBattleHealthCard({
  label,
  name,
  current,
  max,
  tone,
  lastDamage,
  damageLabel,
}) {
  const safeCurrent = Math.max(0, Math.round(Number(current) || 0));
  const safeMax = Math.max(1, Math.round(Number(max) || 1));
  const safeLastDamage = Math.max(0, Math.round(Number(lastDamage) || 0));
  const percent = Math.round(clamp((safeCurrent / safeMax) * 100, 0, 100));
  const previousPercent = Math.round(
    clamp(((safeCurrent + safeLastDamage) / safeMax) * 100, 0, 100)
  );
  const lossPercent = Math.max(0, previousPercent - percent);
  const damageBurst = renderJourneyBossBattleDamageBurst(
    safeLastDamage,
    safeMax,
    tone,
    damageLabel
  );

  return `
    <section class="journey-battle-health-card is-${escapeAttribute(tone)}">
      <div class="journey-battle-health-head">
        <div>
          <span class="journey-battle-health-label">${escapeHtml(label)}</span>
          <strong>${escapeHtml(name)}</strong>
        </div>
        <span class="journey-battle-health-value">${safeCurrent} / ${safeMax}</span>
      </div>
      <div class="journey-battle-health-track">
        <div
          class="journey-battle-health-fill is-${escapeAttribute(tone)}"
          style="width: ${percent}%"
        ></div>
        ${
          lossPercent > 0
            ? `
              <div
                class="journey-battle-health-loss is-${escapeAttribute(tone)}"
                style="left: ${percent}%; width: ${lossPercent}%"
              ></div>
            `
            : ""
        }
      </div>
      <div class="journey-battle-health-meta">
        <span>${percent}%</span>
        ${damageBurst}
      </div>
    </section>
  `;
}

function renderJourneyBossBattleDamageBurst(damage, max, tone, damageLabel) {
  if (!damage) {
    return `<span class="journey-battle-damage-pill is-muted">No damage last exchange</span>`;
  }

  const chevrons = new Array(getJourneyBattleChevronCount(damage, max)).fill("›").join("");

  return `
    <span class="journey-battle-damage-pill is-${escapeAttribute(tone)}">
      <span class="journey-battle-damage-chevrons" aria-hidden="true">${escapeHtml(
        chevrons
      )}</span>
      <span>${escapeHtml(damageLabel)} ${damage}</span>
    </span>
  `;
}

function getJourneyBattleChevronCount(damage, max) {
  const safeMax = Math.max(1, Number(max) || 1);
  const ratio = clamp((Number(damage) || 0) / safeMax, 0, 1);

  if (ratio >= 0.34) return 3;
  if (ratio >= 0.18) return 2;
  return 1;
}

function getJourneyBossBattleArt(battle) {
  return JOURNEY_BATTLE_ART[Math.max(0, Math.floor(Number(battle?.bossIndex) || 0))] || null;
}

function getJourneyBattleMonogram(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function renderIdleJourney(state, games, sessions, xpSummary) {
  if (!journeyContentEl) return;

  const viewModel = buildJourneyViewModel(state, games, sessions, xpSummary);
  const stretchSprite = getJourneyStretchSprite(
    viewModel.state,
    viewModel.hpPercent,
    viewModel.hungerPercent
  );
  const progressDisplay = buildJourneyProgressDisplay({
    state: viewModel.state,
    progress: viewModel.progress,
    stretchPresentation: viewModel.stretchPresentation,
    journeyStats: viewModel.journeyStats,
  });
  const pendingEventsMarkup = viewModel.state.pendingEvents.length
    ? `
        <article class="journey-side-card journey-alert-card">
          <p class="journey-overline">${escapeHtml(t("journeyUi.page.eventQueue"))}</p>
          <h4>${escapeHtml(t("journeyUi.page.awaitingChoice"))}</h4>
          <p class="muted-text">
            ${escapeHtml(t("journeyUi.page.eventQueueBody"))}
          </p>
          <div class="journey-event-list">
            ${viewModel.state.pendingEvents
              .map(
                (eventEntry) => `
                  <button
                    type="button"
                    class="secondary-button journey-event-button"
                    data-journey-action="open-event"
                    data-event-id="${eventEntry.id}"
                  >
                    <span class="journey-event-button-head">
                      <span class="journey-event-kicker">${escapeHtml(
                        t("journeyUi.home.newEvent")
                      )}</span>
                    </span>
                    <span class="journey-event-title">${escapeHtml(
                      getJourneyEventTitle(eventEntry.title)
                    )}</span>
                  </button>
                `
              )
              .join("")}
          </div>
        </article>
      `
    : `
        <article class="journey-side-card">
          <p class="journey-overline">${escapeHtml(t("journeyUi.page.quietStretch"))}</p>
          <h4>${escapeHtml(t("journeyUi.page.noImmediateEvent"))}</h4>
          <p class="muted-text">
            ${escapeHtml(t("journeyUi.page.quietStretchBody"))}
          </p>
        </article>
      `;

  journeyContentEl.innerHTML = `
    <section class="journey-route-card">
      <div class="journey-route-hero">
        <div class="journey-route-copy">
          <p class="journey-overline">${escapeHtml(t("journeyUi.page.currentStretch"))}</p>
          <div class="journey-title-row">
            <h3>${escapeHtml(viewModel.displayName)} • Lv. ${viewModel.journeyLevel}</h3>
            <span class="journey-chip is-active">${escapeHtml(viewModel.zoneName)}</span>
            <span class="journey-chip">${escapeHtml(viewModel.statusLabel)}</span>
            ${
              viewModel.state.pendingEvents.length
                ? `<span class="journey-chip is-warning">${escapeHtml(
                    t("journeyUi.page.eventWaiting", {
                      count: viewModel.state.pendingEvents.length,
                    })
                  )}</span>`
                : ""
            }
          </div>
          <p class="journey-zone">${escapeHtml(viewModel.activityText)}</p>
        </div>
        ${renderJourneySpriteBanner(stretchSprite.sprite, {
          wrapperClass: "journey-route-sprite-banner",
          stageClass: "journey-sprite-stage-route",
          label: stretchSprite.label,
        })}
      </div>
      ${renderJourneyProgressDisplay(progressDisplay)}

      <div class="journey-story-stats journey-story-stats-compact">
        <div class="journey-story-stat">
          <span>${escapeHtml(t("journeyUi.page.currentGoal"))}</span>
          <strong>${escapeHtml(viewModel.stretchPresentation.goalTitle)}</strong>
        </div>
        <div class="journey-story-stat">
          <span>${escapeHtml(viewModel.stretchPresentation.horizonLabel)}</span>
          <strong>${escapeHtml(viewModel.stretchPresentation.horizonValue)}</strong>
        </div>
        <div class="journey-story-stat">
          <span>${escapeHtml(t("journeyUi.page.nextDanger"))}</span>
          <strong>${escapeHtml(viewModel.nextThreatLabel)}</strong>
        </div>
        <div class="journey-story-stat">
          <span>${escapeHtml(t("journeyUi.page.travelPace"))}</span>
          <strong>${escapeHtml(
            t("journeyUi.page.travelPaceValue", {
              value: viewModel.journeyStats.speedPerHour.toFixed(1),
            })
          )}</strong>
        </div>
      </div>

      <p class="muted-text">
        ${escapeHtml(viewModel.stretchPresentation.innerThoughts)}
      </p>
    </section>

    <section class="journey-adventure-grid">
      ${pendingEventsMarkup}

      <article class="journey-side-card">
        <p class="journey-overline">${escapeHtml(
          t("journeyUi.page.expeditionFocus")
        )}</p>
        <h4>${escapeHtml(t("journeyUi.page.expeditionFocusTitle"))}</h4>
        <div class="journey-story-stats">
          <div class="journey-story-stat">
            <span>${escapeHtml(t("journeyUi.common.health"))}</span>
            <strong>${Math.round(viewModel.state.currentHp)} / ${viewModel.journeyStats.maxHp}</strong>
          </div>
          <div class="journey-story-stat">
            <span>${escapeHtml(t("journeyUi.common.hunger"))}</span>
            <strong>${Math.round(viewModel.state.currentHunger)} / ${viewModel.journeyStats.maxHunger}</strong>
          </div>
          <button
            type="button"
            class="journey-story-stat journey-story-stat-button"
            data-journey-action="open-road-history"
          >
            <span>${escapeHtml(t("journeyUi.page.roadsCleared"))}</span>
            <strong>${viewModel.clearedRoadCount}</strong>
          </button>
          <button
            type="button"
            class="journey-story-stat journey-story-stat-button"
            data-journey-action="open-retreat-history"
          >
            <span>${escapeHtml(t("journeyUi.page.retreats"))}</span>
            <strong>${viewModel.retreatCount}</strong>
          </button>
        </div>
      </article>
    </section>

    <section class="journey-log-grid">
      <article class="journey-log-card">
        <p class="journey-overline">${escapeHtml(t("journeyUi.page.travelLog"))}</p>
        <h4>${escapeHtml(t("journeyUi.page.recentEvents"))}</h4>
        <div class="journey-log-list">
          ${viewModel.state.log.length
            ? viewModel.state.log
                .map(
                  (entry) => `
                    <div class="journey-log-entry">
                      <p>${escapeHtml(getJourneyLogText(entry.text))}</p>
                      <time>${formatDateTime(entry.at)}</time>
                    </div>
                  `
                )
                .join("")
            : `<div class="journey-log-entry"><p>${escapeHtml(
                t("journeyUi.page.recentEventsEmpty")
              )}</p></div>`}
        </div>
      </article>

      <article class="journey-log-card">
        <p class="journey-overline">${escapeHtml(t("journeyUi.page.roadNotes"))}</p>
        <h4>${escapeHtml(t("journeyUi.page.roadNotesTitle"))}</h4>
        <div class="journey-character-list">
          <div class="journey-log-entry">
            <p>${escapeHtml(
              viewModel.state.status === "recovering"
                ? getRecoveryText(viewModel.state)
                : t("journeyUi.page.nextThreatEta", {
                    value: viewModel.nextThreatLabel,
                  })
            )}</p>
          </div>
          ${viewModel.knownNotes.length
            ? viewModel.knownNotes
                .map(
                  (note) => `
                    <div class="journey-log-entry">
                      <p>${escapeHtml(note)}</p>
                    </div>
                  `
                )
                .join("")
            : `<div class="journey-log-entry"><p>${escapeHtml(
                t("journeyUi.page.learningWorld")
              )}</p></div>`}
        </div>
      </article>
    </section>

    <details class="journey-debug-panel">
      <summary>${escapeHtml(t("journeyUi.page.debugTools"))}</summary>
      <div class="journey-debug-panel-body">
        <p class="muted-text">
          ${escapeHtml(t("journeyUi.page.debugBody"))}
        </p>
        <div class="journey-class-list">
          <button type="button" class="secondary-button" data-journey-action="debug-advance" data-hours="6">${escapeHtml(
            t("journeyUi.page.advance6h")
          )}</button>
          <button type="button" class="secondary-button" data-journey-action="debug-advance" data-hours="24">${escapeHtml(
            t("journeyUi.page.advance24h")
          )}</button>
          <button type="button" class="secondary-button" data-journey-action="debug-advance" data-hours="72">${escapeHtml(
            t("journeyUi.page.advance3d")
          )}</button>
          <button type="button" class="secondary-button" data-journey-action="debug-event">${escapeHtml(
            t("journeyUi.page.forceEvent")
          )}</button>
          <button type="button" class="secondary-button" data-journey-action="debug-undo">${escapeHtml(
            t("journeyUi.page.undoDebugStep")
          )}</button>
          <button type="button" class="secondary-button action-warning" data-journey-action="reset-journey">${escapeHtml(
            t("journeyUi.page.resetJourneyOnly")
          )}</button>
        </div>
      </div>
    </details>
  `;
}

export function renderCharacterSheet(state, games, sessions, xpSummary) {
  if (!characterContentEl) return;

  const viewModel = buildJourneyViewModel(state, games, sessions, xpSummary);
  const showNameEditor = !viewModel.state.characterName || appState.editingCharacterName;

  characterContentEl.innerHTML = `
    <section class="character-hero-card">
      <div class="character-hero-layout">
        <div class="character-portrait-panel">
          ${renderJourneySpriteImage(JOURNEY_PORTRAIT_SPRITE, {
            stageClass: "journey-sprite-stage-portrait",
          })}
        </div>

        <div class="character-identity-panel">
          <div class="journey-title-row">
            <h3>${escapeHtml(viewModel.displayName)}</h3>
            ${
              viewModel.state.characterName
                ? `
                    <button
                      type="button"
                      class="character-name-edit-button"
                      data-journey-action="toggle-name-editor"
                      aria-label="${escapeAttribute(
                        t("journeyUi.character.editCharacterName")
                      )}"
                    >
                      ✎
                    </button>
                  `
                : ""
            }
            <span class="journey-chip">${escapeHtml(viewModel.classLabel)}</span>
            <span class="journey-chip">${escapeHtml(viewModel.statusLabel)}</span>
          </div>

          ${
            showNameEditor
              ? `
                  <div class="journey-character-name-row">
                    <input
                      id="journeyCharacterNameInput"
                      type="text"
                      maxlength="30"
                      placeholder="${escapeAttribute(
                        t("journeyUi.character.namePlaceholder")
                      )}"
                      value="${escapeAttribute(viewModel.state.characterName)}"
                    />
                    <button
                      type="button"
                      class="secondary-button"
                      data-journey-action="save-name"
                    >
                      ${escapeHtml(t("journeyUi.character.saveName"))}
                    </button>
                  </div>
                `
              : ""
          }

          <div class="character-vitals-grid">
            ${renderCharacterVitalChip({
              icon: "♥",
              label: t("journeyUi.common.hpShort"),
              value: `${Math.round(viewModel.state.currentHp)} / ${viewModel.journeyStats.maxHp}`,
              toneClass: "is-health",
            })}
            ${renderCharacterVitalChip({
              icon: "◔",
              label: t("journeyUi.common.hunger"),
              value: `${Math.round(viewModel.state.currentHunger)} / ${viewModel.journeyStats.maxHunger}`,
              toneClass: "is-hunger",
            })}
          </div>
          ${renderCharacterLevelPanel(viewModel)}

          ${renderJourneyRadarChart(viewModel.journeyStats)}
        </div>
      </div>
    </section>

    <section class="character-build-grid">
      <article class="journey-side-card character-radar-card">
        <p class="journey-overline">${escapeHtml(t("journeyUi.character.loadout"))}</p>
        <h4>${escapeHtml(t("journeyUi.character.loadoutTitle"))}</h4>
        <div class="journey-character-list">
          <div class="journey-log-entry">
            <p><strong>${escapeHtml(t("journeyUi.character.discipline"))}:</strong> ${escapeHtml(viewModel.classLabel)}</p>
          </div>
          <div class="journey-log-entry">
            <p><strong>${escapeHtml(t("journeyUi.character.equippedWeapon"))}:</strong> ${escapeHtml(
              viewModel.journeyStats.equippedWeaponMeta
                ? getJourneyWeaponLabel(
                    viewModel.state.equippedWeaponKey,
                    viewModel.journeyStats.equippedWeaponMeta.label
                  )
                : t("journeyUi.character.stillUnarmed")
            )}</p>
          </div>
          <div class="journey-log-entry">
            <p><strong>${escapeHtml(t("journeyUi.character.bag"))}:</strong> ${escapeHtml(
              getJourneyBagLabel(viewModel.state.bagKey, viewModel.bagMeta.label)
            )}</p>
          </div>
          <div class="journey-log-entry">
            <p><strong>${escapeHtml(t("journeyUi.character.starterKeepsake"))}:</strong> ${escapeHtml(
              getJourneyStarterItemLabel(viewModel.state.starterItem)
            )}</p>
          </div>
          <div class="journey-log-entry">
            <p><strong>${escapeHtml(t("journeyUi.character.carryLimits"))}:</strong> ${escapeHtml(
              t("journeyUi.character.carryLimitsValue", {
                weaponSlots: viewModel.bagMeta.weaponSlots,
                rationCapacity: viewModel.supplies.rationCapacity,
                tonicCapacity: viewModel.supplies.tonicCapacity,
              })
            )}</p>
          </div>
        </div>
        <p class="muted-text">${escapeHtml(
          getJourneyBagDescription(viewModel.state.bagKey, viewModel.bagMeta.description)
        )}</p>
      </article>

      <article class="journey-side-card">
        <p class="journey-overline">${escapeHtml(t("journeyUi.character.inventory"))}</p>
        <h4>${escapeHtml(t("journeyUi.character.inventoryTitle"))}</h4>
        <div class="summary-row">
          <span class="summary-pill">${escapeHtml(t("journeyUi.character.weapons"))} <strong>${viewModel.weaponInventory.length} / ${viewModel.bagMeta.weaponSlots}</strong></span>
          <span class="summary-pill">${escapeHtml(t("journeyUi.character.rations"))} <strong>${viewModel.supplies.availableRations} / ${viewModel.supplies.rationCapacity}</strong></span>
          <span class="summary-pill">${escapeHtml(t("journeyUi.character.tonics"))} <strong>${viewModel.supplies.availableTonics} / ${viewModel.supplies.tonicCapacity}</strong></span>
        </div>
        <div class="journey-resource-actions character-inventory-actions">
          <button
            type="button"
            class="secondary-button"
            data-journey-action="use-tonic"
            ${viewModel.supplies.availableTonics <= 0 ? "disabled" : ""}
          >
            ${escapeHtml(
              t("journeyUi.character.useTonic", {
                count: viewModel.supplies.availableTonics,
              })
            )}
          </button>
          <button
            type="button"
            class="secondary-button"
            data-journey-action="use-ration"
            ${viewModel.supplies.availableRations <= 0 ? "disabled" : ""}
          >
            ${escapeHtml(
              t("journeyUi.character.eatRation", {
                count: viewModel.supplies.availableRations,
              })
            )}
          </button>
        </div>
        <div class="journey-character-list">
          ${viewModel.weaponInventory.length
            ? viewModel.weaponInventory
                .map((weapon) => renderJourneyWeaponCard(weapon))
                .join("")
            : `
                <div class="journey-log-entry">
                  <p>${escapeHtml(t("journeyUi.character.travellingLight"))}</p>
                </div>
              `}
        </div>
        ${
          viewModel.supplies.autoConsumedRations || viewModel.supplies.autoConsumedTonics
            ? `
                <p class="muted-text">
                  ${escapeHtml(t("journeyUi.character.autoConsumeNote"))}
                </p>
              `
            : ""
        }
        ${
          viewModel.pendingWeapons.length
            ? `
                <div class="journey-character-list journey-pending-weapon-list">
                  ${viewModel.pendingWeapons
                    .map((weapon) =>
                      renderJourneyPendingWeaponCard(
                        weapon,
                        viewModel.weaponInventory,
                        viewModel.bagMeta.weaponSlots
                      )
                    )
                    .join("")}
                </div>
              `
            : ""
        }
      </article>
    </section>

    <section class="character-build-grid">
      <article class="journey-side-card">
        <p class="journey-overline">${escapeHtml(t("journeyUi.character.classDiscipline"))}</p>
        <h4>${escapeHtml(viewModel.classLabel)}</h4>
        <p class="muted-text">${escapeHtml(viewModel.classDescription)}</p>
        ${buildJourneyClassSelectionUi(viewModel.state)}
        ${
          viewModel.knownNotes.length
            ? `
              <div class="journey-character-list">
                ${viewModel.knownNotes
                  .map(
                    (note) => `
                      <div class="journey-log-entry">
                        <p>${escapeHtml(note)}</p>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            `
            : `<p class="muted-text">${escapeHtml(
                t("journeyUi.character.learnedBySurviving")
              )}</p>`
        }
      </article>
    </section>
  `;

  renderCharacterSkillModal(viewModel);
  syncBodyScrollLock();
}

export function buildJourneyClassSelectionUi(state) {
  const unlockedClasses = state.unlockedClasses.filter(
    (classKey) => JOURNEY_CLASS_META[classKey]
  );
  const advancedUnlocked = unlockedClasses.filter(
    (classKey) => classKey !== JOURNEY_BASE_CLASS
  );

  return advancedUnlocked.length
    ? `
        <div class="journey-class-list">
          ${unlockedClasses
            .map((classKey) => {
              return `
                <button
                  type="button"
                  class="secondary-button ${
                    state.classType === classKey ? "action-success" : ""
                  }"
                  data-journey-action="set-class"
                  data-class="${classKey}"
                >
                  ${escapeHtml(getJourneyClassLabel(classKey))}
                </button>
              `;
            })
            .join("")}
        </div>
        <p class="muted-text">${escapeHtml(t("journeyUi.character.hiddenPaths"))}</p>
      `
    : `<p class="muted-text">${escapeHtml(t("journeyUi.character.noDiscipline"))}</p>`;
}

export function getJourneyDisplayName(state) {
  return state.characterName || t("journeyUi.common.namelessWanderer");
}

export function initializeJourneySpritePreviews(root = document) {
  const spriteSheets = root.querySelectorAll("[data-journey-sprite-sheet]");

  for (const spriteSheet of spriteSheets) {
    configureJourneySpriteSheet(spriteSheet);
  }
}

function buildJourneyViewModel(state, games, sessions, xpSummary) {
  const journeyLevel = getJourneyLevel(state, xpSummary.level);
  const journeyStats = buildJourneyDerived(state, journeyLevel);
  const supplies = buildJourneySupplies(games, sessions, state);
  const boss = getJourneyBoss(state.bossIndex);
  const progress = getJourneySegmentProgress(state.totalDistance, state.bossIndex);
  const stretchPresentation = buildJourneyStretchPresentation(
    state,
    boss,
    progress,
    journeyStats,
    supplies
  );
  const unspentSkillPoints = getUnspentSkillPoints(state, journeyLevel);
  const activityText = getJourneyActivityText(
    state,
    boss,
    progress,
    journeyStats,
    supplies
  );
  const nextBossEtaHours =
    progress.remainingDistance / Math.max(0.01, journeyStats.speedPerHour);
  const hpPercent = clamp((state.currentHp / journeyStats.maxHp) * 100, 0, 100);
  const hungerPercent = clamp(
    (state.currentHunger / journeyStats.maxHunger) * 100,
    0,
    100
  );
  const storyLevelBonus = getJourneyStoryLevelBonus(state.storyXp);
  const storyXpIntoLevel = state.storyXp % JOURNEY_STORY_XP_PER_LEVEL;
  const storyXpToNextLevel =
    storyXpIntoLevel === 0
      ? JOURNEY_STORY_XP_PER_LEVEL
      : JOURNEY_STORY_XP_PER_LEVEL - storyXpIntoLevel;
  const storyProgressPercent =
    (storyXpIntoLevel / JOURNEY_STORY_XP_PER_LEVEL) * 100;
  const displayName = getJourneyDisplayName(state);
  const bagMeta = getJourneyBagMeta(state.bagKey);
  const weaponInventory = getJourneyWeaponInventory(state);
  const pendingWeapons = getJourneyPendingWeapons(state);
  const knownNotes = getJourneyKnownNotes(state);
  const clearedRoads = Array.isArray(state.clearedRoads) ? state.clearedRoads : [];
  const retreatHistory = Array.isArray(state.retreatHistory) ? state.retreatHistory : [];
  const levelProgress =
    storyXpToNextLevel <= xpSummary.xpToNextLevel
      ? {
          sourceLabel: t("journeyUi.character.storyXp"),
          current: storyXpIntoLevel,
          goal: JOURNEY_STORY_XP_PER_LEVEL,
          remaining: storyXpToNextLevel,
          progressPercent: storyProgressPercent,
        }
      : {
          sourceLabel: t("journeyUi.character.trackerXp"),
          current: xpSummary.xpIntoLevel,
          goal: 100,
          remaining: xpSummary.xpToNextLevel,
          progressPercent: xpSummary.progressPercent,
        };

  return {
    state,
    xpSummary,
    journeyLevel,
    journeyStats,
    supplies,
    boss,
    progress,
    stretchPresentation,
    unspentSkillPoints,
    activityText,
    nextThreatLabel:
      state.status === "recovering"
        ? t("journeyUi.progress.recoveryComesFirst")
        : formatDurationRangeHours(nextBossEtaHours),
    hpPercent,
    hungerPercent,
    storyLevelBonus,
    storyXpIntoLevel,
    storyXpToNextLevel,
    storyProgressPercent,
    levelProgress,
    displayName,
    bagMeta,
    weaponInventory,
    pendingWeapons,
    knownNotes,
    clearedRoads,
    retreatHistory,
    clearedRoadCount: Math.max(state.bossIndex, clearedRoads.length),
    retreatCount: Math.max(state.townVisits, retreatHistory.length),
    latestClearedRoad: clearedRoads[0] || null,
    latestRetreat: retreatHistory[0] || null,
    classLabel: getJourneyClassLabel(state.classType),
    classDescription: getJourneyClassDescription(state.classType),
    statusLabel: getJourneyStatusLabel(state.status),
    zoneName: getJourneyZoneName(state.bossIndex),
  };
}

function renderJourneyStatCards(viewModel) {
  return JOURNEY_STAT_KEYS.map((statKey) => {
    const statMeta = {
      label: getJourneyStatLabel(statKey),
      help: getJourneyStatHelp(statKey),
    };
    const breakdown = viewModel.journeyStats.statBreakdown[statKey];
    const hasClassBonus = breakdown.classBonus > 0;
    const hasWeaponBonus = breakdown.weaponBonus > 0;
    const modifierText = breakdown.modifier
      ? t("journeyUi.stats.modifier", {
          value: `${breakdown.modifier > 0 ? "+" : ""}${breakdown.modifier}`,
        })
      : "";
    const modifierSourceMarkup = renderJourneyModifierSourceNotes(breakdown);

    return `
      <article class="journey-stat-card character-stat-card-item ${
        hasClassBonus ? "has-class-bonus" : ""
      } ${hasWeaponBonus ? "has-weapon-bonus" : ""}">
        <div class="stat-row">
          <h4>${escapeHtml(statMeta.label)}</h4>
          <strong>${breakdown.total}</strong>
        </div>
        <div class="journey-inline-row stat-source-row">
          <span class="journey-chip">${escapeHtml(
            t("journeyUi.stats.base", { value: breakdown.base })
          )}</span>
          ${
            hasClassBonus
              ? `<span class="journey-chip is-class">${escapeHtml(
                  t("journeyUi.stats.classBonus", { value: breakdown.classBonus })
                )}</span>`
              : ""
          }
          ${
            hasWeaponBonus
              ? `<span class="journey-chip is-weapon">${escapeHtml(
                  t("journeyUi.stats.weaponBonus", { value: breakdown.weaponBonus })
                )}</span>`
              : ""
          }
          ${
            modifierText
              ? `<span class="journey-chip">${escapeHtml(modifierText)}</span>`
              : ""
          }
        </div>
        <p class="stat-help">${escapeHtml(statMeta.help)}</p>
        ${modifierSourceMarkup}
        <div class="journey-skill-actions">
          <button
            type="button"
            class="secondary-button"
            data-journey-action="spend-stat"
            data-stat="${statKey}"
            ${viewModel.unspentSkillPoints <= 0 ? "disabled" : ""}
          >
            ${escapeHtml(t("journeyUi.stats.plusOne", { label: statMeta.label }))}
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function renderCharacterLevelPanel(viewModel) {
  return `
    <section class="character-level-card">
      <div class="character-level-header">
        <div>
          <p class="journey-overline">${escapeHtml(t("journeyUi.character.characterLevel"))}</p>
          <div class="character-level-title-row">
            <strong>${escapeHtml(
              t("journeyUi.character.levelLabel", { level: viewModel.journeyLevel })
            )}</strong>
            ${
              viewModel.unspentSkillPoints > 0
                ? `<span class="journey-chip is-active">${escapeHtml(
                    t("journeyUi.character.pointsReady", {
                      count: viewModel.unspentSkillPoints,
                    })
                  )}</span>`
                : ""
            }
          </div>
        </div>
        ${
          viewModel.unspentSkillPoints > 0
            ? `
                <button
                  type="button"
                  class="character-level-up-button"
                  data-journey-action="open-skill-modal"
                  aria-label="${escapeAttribute(
                    t("journeyUi.character.spendSkillPoints")
                  )}"
                >
                  +
                </button>
              `
            : ""
        }
      </div>
      <div class="journey-progress-track character-level-progress">
        <div
          class="journey-progress-fill character-level-progress-fill"
          style="width: ${viewModel.levelProgress.progressPercent}%"
        ></div>
      </div>
      <div class="journey-progress-meta character-level-meta">
        <span>${escapeHtml(
          t("journeyUi.character.xpProgress", {
            current: viewModel.levelProgress.current,
            goal: viewModel.levelProgress.goal,
          })
        )}</span>
        <span>${escapeHtml(
          t("journeyUi.character.xpToNext", {
            remaining: viewModel.levelProgress.remaining,
          })
        )}</span>
      </div>
      ${renderCharacterLevelBreakdown(viewModel)}
    </section>
  `;
}

function renderCharacterLevelBreakdown(viewModel) {
  return `
    <details class="character-level-breakdown">
      <summary class="character-level-breakdown-summary">
        <span>${escapeHtml(t("journeyUi.character.seeXpSources"))}</span>
        <span class="character-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="character-level-breakdown-panel">
        <div class="journey-character-list">
          <div class="journey-log-entry">
            <p><strong>${escapeHtml(t("journeyUi.character.totalCharacterLevel"))}:</strong> ${viewModel.journeyLevel}</p>
            <p class="muted-text">${escapeHtml(
              t("journeyUi.character.trackerLevelStoryBonus", {
                trackerLevel: viewModel.xpSummary.level,
                storyBonus:
                  viewModel.storyLevelBonus >= 0
                    ? `+${viewModel.storyLevelBonus}`
                    : viewModel.storyLevelBonus,
              })
            )}</p>
          </div>
          <div class="journey-log-entry">
            <p><strong>${escapeHtml(t("journeyUi.character.trackerXp"))}:</strong> ${viewModel.xpSummary.totalXp}</p>
            <div class="journey-inline-row stat-source-row">
              <span class="journey-chip">${escapeHtml(
                getCurrentLocale() === "ja"
                  ? `セッション ${viewModel.xpSummary.sessionXp}`
                  : `Sessions ${viewModel.xpSummary.sessionXp}`
              )}</span>
              <span class="journey-chip">${escapeHtml(
                getCurrentLocale() === "ja"
                  ? `完了 ${viewModel.xpSummary.completionXp}`
                  : `Completions ${viewModel.xpSummary.completionXp}`
              )}</span>
              <span class="journey-chip">${escapeHtml(
                getCurrentLocale() === "ja"
                  ? `連続 ${viewModel.xpSummary.streakBonus}`
                  : `Streak ${viewModel.xpSummary.streakBonus}`
              )}</span>
            </div>
          </div>
          <div class="journey-log-entry">
            <p><strong>${escapeHtml(t("journeyUi.character.storyXp"))}:</strong> ${viewModel.state.storyXp}</p>
            <div class="journey-inline-row stat-source-row">
              <span class="journey-chip">${escapeHtml(
                t("journeyUi.character.currentStoryBar", {
                  current: viewModel.storyXpIntoLevel,
                  total: JOURNEY_STORY_XP_PER_LEVEL,
                })
              )}</span>
              <span class="journey-chip is-active">${escapeHtml(
                t("journeyUi.character.storyBonusValue", {
                  value: viewModel.storyLevelBonus,
                })
              )}</span>
            </div>
          </div>
        </div>
      </div>
    </details>
  `;
}

function renderCharacterSkillModal(viewModel) {
  if (!characterSkillModalRoot) {
    return;
  }

  if (!appState.showCharacterSkillModal) {
    characterSkillModalRoot.innerHTML = "";
    syncBodyScrollLock();
    return;
  }

  const previousLevel = Math.max(
    1,
    viewModel.journeyLevel - Math.max(1, viewModel.unspentSkillPoints)
  );

  characterSkillModalRoot.innerHTML = `
    <div
      class="character-skill-modal"
      data-character-skill-modal
    >
      <button
        type="button"
        class="character-skill-backdrop"
        data-journey-action="close-skill-modal"
        aria-label="${escapeAttribute(t("common.close"))}"
      ></button>
      <div
        class="character-skill-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="characterSkillModalTitle"
      >
        <div class="character-skill-modal-header">
          <div>
            <p class="journey-overline">${escapeHtml(t("journeyUi.character.levelUp"))}</p>
            <h4 id="characterSkillModalTitle">${escapeHtml(viewModel.displayName)}</h4>
            <p class="character-skill-level-line">
              ${escapeHtml(
                t("journeyUi.character.levelTransition", {
                  from: previousLevel,
                  to: viewModel.journeyLevel,
                })
              )}
            </p>
            <p class="character-skill-points-line">
              ${escapeHtml(
                t("journeyUi.character.skillPointsAvailable", {
                  count: viewModel.unspentSkillPoints,
                })
              )}
            </p>
          </div>
          <button
            type="button"
            class="secondary-button"
            data-journey-action="close-skill-modal"
          >
            ${escapeHtml(t("common.close"))}
          </button>
        </div>
        <div class="journey-stat-grid character-skill-grid">
          ${renderJourneyStatCards(viewModel)}
        </div>
      </div>
    </div>
  `;

  syncBodyScrollLock();
}

function renderJourneyWeaponCard(weapon) {
  return `
    <article class="journey-log-entry journey-weapon-card ${
      weapon.equipped ? "is-equipped" : ""
    }">
      <div class="journey-title-row">
        <strong>${escapeHtml(getJourneyWeaponLabel(weapon.key, weapon.meta.label))}</strong>
        <span class="journey-chip">${escapeHtml(
          getJourneyWeaponTier(weapon.key, weapon.meta.tier)
        )}</span>
        ${
          weapon.equipped
            ? `<span class="journey-chip is-active">${escapeHtml(
                t("journeyUi.character.equipped")
              )}</span>`
            : ""
        }
      </div>
      <p class="muted-text">${escapeHtml(
        getJourneyWeaponDescription(weapon.key, weapon.meta.description)
      )}</p>
      <div class="journey-inline-row stat-source-row">
        ${renderWeaponBonusChips(weapon.meta.bonuses)}
      </div>
      <div class="journey-skill-actions">
        ${
          weapon.equipped
            ? `<span class="journey-weapon-status-note">${escapeHtml(
                t("journeyUi.character.currentlyEquipped")
              )}</span>`
            : `
                <button
                  type="button"
                  class="secondary-button"
                  data-journey-action="equip-weapon"
                  data-weapon="${weapon.key}"
                >
                  ${escapeHtml(t("journeyUi.character.equip"))}
                </button>
              `
        }
      </div>
    </article>
  `;
}

function renderJourneyPendingWeaponCard(weapon, currentWeapons, weaponSlots) {
  const canKeep = currentWeapons.length < weaponSlots;

  return `
    <article class="journey-log-entry journey-weapon-card is-pending">
      <div class="journey-title-row">
        <strong>${escapeHtml(getJourneyWeaponLabel(weapon.key, weapon.meta.label))}</strong>
        <span class="journey-chip is-warning">${escapeHtml(
          t("journeyUi.character.newFind")
        )}</span>
        <span class="journey-chip">${escapeHtml(
          getJourneyWeaponTier(weapon.key, weapon.meta.tier)
        )}</span>
      </div>
      <p class="muted-text">${escapeHtml(
        getJourneyWeaponDescription(weapon.key, weapon.meta.description)
      )}</p>
      <div class="journey-inline-row stat-source-row">
        ${renderWeaponBonusChips(weapon.meta.bonuses)}
      </div>
      <div class="journey-skill-actions">
        ${
          canKeep
            ? `
                <button
                  type="button"
                  class="secondary-button"
                  data-journey-action="keep-weapon"
                  data-weapon="${weapon.key}"
                >
                  ${escapeHtml(t("journeyUi.character.keepIt"))}
                </button>
              `
            : currentWeapons
                .map(
                  (currentWeapon) => `
                    <button
                      type="button"
                      class="secondary-button"
                      data-journey-action="replace-weapon"
                      data-weapon="${weapon.key}"
                      data-replace="${currentWeapon.key}"
                    >
                      ${escapeHtml(
                        t("journeyUi.character.swapWith", {
                          weapon: getJourneyWeaponLabel(
                            currentWeapon.key,
                            currentWeapon.meta.label
                          ),
                        })
                      )}
                    </button>
                  `
                )
                .join("")
        }
        <button
          type="button"
          class="secondary-button"
          data-journey-action="discard-pending-weapon"
          data-weapon="${weapon.key}"
        >
          ${escapeHtml(t("journeyUi.character.leaveIt"))}
        </button>
      </div>
    </article>
  `;
}

function renderWeaponBonusChips(bonuses) {
  return JOURNEY_STAT_KEYS.filter((statKey) => (bonuses?.[statKey] || 0) > 0)
    .map(
      (statKey) => `
        <span class="journey-chip is-weapon">
          ${escapeHtml(getJourneyStatLabel(statKey))} +${bonuses[statKey]}
        </span>
      `
    )
    .join("");
}

function renderCharacterResourceCard(config) {
  return `
    <article class="journey-resource-card character-resource-card">
      <div class="character-resource-header">
        <div class="journey-title-row">
          <h4>${escapeHtml(config.title)}</h4>
          <span class="journey-chip">${escapeHtml(config.statLabel)} ${config.statValue}</span>
        </div>
        ${renderJourneyInlineHelp(config.infoLabel, config.infoLines)}
      </div>
      <div class="resource-track">
        <div class="resource-fill ${config.fillClass}" style="width: ${config.percent}%"></div>
      </div>
      <div class="resource-meta">
        <span>${config.current} / ${config.max}</span>
        <span>${Math.round(config.percent)}%</span>
      </div>
      <div class="journey-resource-actions">
        <button
          type="button"
          class="secondary-button"
          data-journey-action="${config.action}"
          ${config.disabled ? "disabled" : ""}
        >
          ${escapeHtml(config.actionText)}
        </button>
      </div>
    </article>
  `;
}

function renderCharacterVitalChip(config) {
  return `
    <div class="character-vital-chip ${escapeAttribute(config.toneClass || "")}">
      <span class="character-vital-icon" aria-hidden="true">${escapeHtml(config.icon)}</span>
      <div class="character-vital-copy">
        <span>${escapeHtml(config.label)}</span>
        <strong>${escapeHtml(config.value)}</strong>
      </div>
    </div>
  `;
}

function getJourneyStretchSprite(state, hpPercent, hungerPercent) {
  if (state.pendingEvents.some((eventEntry) => eventEntry.kind === "boss")) {
    return {
      sprite: JOURNEY_ATTACK_SPRITE,
      label: t("journeyUi.common.battling"),
    };
  }

  if (isJourneyFoodRecoverySprite(state, hpPercent, hungerPercent)) {
    return {
      sprite: JOURNEY_BERRY_SPRITE,
      label: t("journeyUi.common.foraging"),
    };
  }

  if (state.status === "recovering" || hpPercent <= 55) {
    return {
      sprite: JOURNEY_INJURED_SPRITE,
      label: t("journeyUi.common.recovering"),
    };
  }

  return {
    sprite: JOURNEY_WALK_SPRITE,
    label: t("journeyUi.common.onRoad"),
  };
}

function isJourneyFoodRecoverySprite(state, hpPercent, hungerPercent) {
  if (state.status !== "recovering") return false;

  const needsHealingFirst = hpPercent <= 22;
  const needsFoodFirst = hungerPercent <= 20 && !needsHealingFirst;

  if (needsFoodFirst) return true;
  if (needsHealingFirst) return false;

  return hpPercent >= 50 && hungerPercent < 55;
}

function renderJourneyInlineHelp(label, lines) {
  return `
    <details class="journey-inline-help">
      <summary class="journey-info-button" aria-label="${escapeAttribute(label)}">i</summary>
      <div class="journey-inline-help-popover">
        ${lines
          .map((line) => `<p>${escapeHtml(line)}</p>`)
          .join("")}
      </div>
    </details>
  `;
}

function renderJourneySpriteBanner(spriteConfig, options = {}) {
  const wrapperClass = options.wrapperClass ? ` ${options.wrapperClass}` : "";

  return `
    <div class="journey-sprite-banner${wrapperClass}">
      ${
        options.label
          ? `<span class="journey-sprite-banner-label">${escapeHtml(options.label)}</span>`
          : ""
      }
      ${renderJourneySpriteImage(spriteConfig, {
        stageClass: options.stageClass || "",
        maxDisplayWidth: options.maxDisplayWidth,
        maxDisplayHeight: options.maxDisplayHeight,
      })}
    </div>
  `;
}

function renderJourneySpriteImage(spriteConfig, options = {}) {
  const stageClass = options.stageClass ? ` ${options.stageClass}` : "";

  return `
    <div class="journey-sprite-stage${stageClass}" aria-hidden="true">
      <img
        class="journey-sprite-sheet"
        src="${spriteConfig.src}"
        data-journey-sprite-sheet
        data-frame-count="${spriteConfig.frameCount}"
        data-frame-duration="${spriteConfig.frameDurationMs}"
        data-max-width="${options.maxDisplayWidth || spriteConfig.maxDisplayWidth}"
        data-max-height="${options.maxDisplayHeight || spriteConfig.maxDisplayHeight}"
        alt=""
      />
    </div>
  `;
}

function renderJourneyRadarChart(journeyStats) {
  const entries = JOURNEY_STAT_KEYS.map((statKey) => {
    const total = Number(journeyStats?.stats?.[statKey] || 0);
    const breakdown = journeyStats?.statBreakdown?.[statKey] || null;

    return {
      key: statKey,
      label: getJourneyStatLabel(statKey),
      value: total,
      breakdown,
    };
  });
  const maxValue = Math.max(10, ...entries.map((entry) => entry.value), 1);
  const center = 130;
  const radius = 76;
  const ringFractions = [0.25, 0.5, 0.75, 1];
  const dataPolygon = buildRadarPolygon(entries, center, radius, maxValue);

  return `
    <div class="character-radar-shell">
      <svg
        class="character-radar-chart"
        viewBox="0 0 260 260"
        role="img"
        aria-label="${escapeAttribute(t("journeyUi.radar.ariaLabel"))}"
      >
        <g class="character-radar-rings">
          ${ringFractions
            .map((fraction) => {
              const ring = buildRadarRing(entries.length, center, radius * fraction);
              return `<polygon points="${ring}" />`;
            })
            .join("")}
        </g>
        <g class="character-radar-axes">
          ${entries
            .map((entry, index) => {
              const axisPoint = getRadarPoint(index, entries.length, center, radius + 12);
              return `<line x1="${center}" y1="${center}" x2="${axisPoint.x}" y2="${axisPoint.y}" />`;
            })
            .join("")}
        </g>
        <polygon class="character-radar-area" points="${dataPolygon}" />
        <polygon class="character-radar-outline" points="${dataPolygon}" />
        <g class="character-radar-points">
          ${entries
            .map((entry, index) => {
              const point = getRadarPoint(
                index,
                entries.length,
                center,
                radius * (entry.value / maxValue)
              );
              return `<circle cx="${point.x}" cy="${point.y}" r="4" style="color: ${escapeAttribute(
                getJourneyRadarPointColor(entry.value, maxValue)
              )};" />`;
            })
            .join("")}
        </g>
        <g class="character-radar-labels">
          ${entries
            .map((entry, index) => {
              const point = getRadarPoint(index, entries.length, center, radius + 40);
              return `<text x="${point.x}" y="${point.y}">${escapeHtml(entry.label)}</text>`;
            })
            .join("")}
        </g>
      </svg>

      <div class="character-radar-legend">
        ${entries.map((entry) => renderCharacterRadarLegendItem(entry)).join("")}
      </div>
    </div>
  `;
}

function renderCharacterRadarLegendItem(entry) {
  const breakdown = entry.breakdown;
  const hasBonus =
    Boolean(breakdown?.classBonus) ||
    Boolean(breakdown?.weaponBonus) ||
    Boolean(breakdown?.modifier);

  return `
    <details class="character-radar-legend-item ${hasBonus ? "is-boosted" : ""}">
      <summary class="character-radar-legend-summary">
        <span>${escapeHtml(entry.label)}</span>
        <div class="character-radar-legend-summary-value">
          <strong class="${hasBonus ? "is-boosted" : ""}">${entry.value}</strong>
          <span class="character-chevron" aria-hidden="true">⌄</span>
        </div>
      </summary>
      ${
        breakdown
          ? `
            <div class="character-radar-legend-detail">
              <div class="journey-inline-row stat-source-row">
                ${renderJourneyStatSourcePills(breakdown)}
              </div>
              ${renderJourneyModifierSourceNotes(breakdown)}
            </div>
          `
          : ""
      }
    </details>
  `;
}

function renderJourneyStatSourcePills(breakdown) {
  const pills = [
    t("journeyUi.stats.base", { value: breakdown.base }),
    t("journeyUi.stats.spent", { value: breakdown.allocated }),
  ];

  if (breakdown.classBonus > 0) {
    pills.push(t("journeyUi.stats.classBonus", { value: breakdown.classBonus }));
  }
  if (breakdown.weaponBonus > 0) {
    pills.push(t("journeyUi.stats.weaponBonus", { value: breakdown.weaponBonus }));
  }
  if (breakdown.modifier) {
    pills.push(
      t("journeyUi.stats.modifier", {
        value: `${breakdown.modifier > 0 ? "+" : ""}${breakdown.modifier}`,
      })
    );
  }

  return pills
    .map((pill) => `<span class="journey-chip">${escapeHtml(pill)}</span>`)
    .join("");
}

function renderJourneyModifierSourceNotes(breakdown) {
  const modifierSources = Array.isArray(breakdown?.modifierSources)
    ? breakdown.modifierSources
    : [];
  if (!modifierSources.length) {
    return "";
  }

  return `
    <div class="journey-character-list">
      ${modifierSources
        .map((source) => {
          const statLabel = getJourneyStatLabel(source.statKey);
          const detailLine = source.detail
            ? `<p class="muted-text">${escapeHtml(source.detail)}</p>`
            : "";
          return `
            <div class="journey-log-entry">
              <p><strong>${escapeHtml(source.title)}</strong> • ${escapeHtml(
                `${statLabel} ${source.amount > 0 ? "+" : ""}${source.amount}`
              )}</p>
              ${detailLine}
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function getJourneyRadarPointColor(value, maxValue) {
  const ratio = clamp(value / Math.max(1, maxValue), 0, 1);
  const hue = 205 + ratio * 14;
  const saturation = 82;
  const lightness = 74 - ratio * 22;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function buildRadarPolygon(entries, center, radius, maxValue) {
  return entries
    .map((entry, index) => {
      const point = getRadarPoint(
        index,
        entries.length,
        center,
        radius * (entry.value / maxValue)
      );
      return `${point.x},${point.y}`;
    })
    .join(" ");
}

function buildRadarRing(pointCount, center, radius) {
  return Array.from({ length: pointCount }, (_, index) => {
    const point = getRadarPoint(index, pointCount, center, radius);
    return `${point.x},${point.y}`;
  }).join(" ");
}

function getRadarPoint(index, count, center, distance) {
  const angle = (-Math.PI / 2) + (index / count) * Math.PI * 2;

  return {
    x: Number((center + Math.cos(angle) * distance).toFixed(2)),
    y: Number((center + Math.sin(angle) * distance).toFixed(2)),
  };
}

function configureJourneySpriteSheet(spriteSheet) {
  if (!(spriteSheet instanceof HTMLImageElement)) return;

  const frameCount = Number.parseInt(spriteSheet.dataset.frameCount || "", 10);
  const frameDurationMs = Number.parseInt(
    spriteSheet.dataset.frameDuration || "",
    10
  );
  const maxDisplayWidth = Number.parseInt(spriteSheet.dataset.maxWidth || "", 10);
  const maxDisplayHeight = Number.parseInt(spriteSheet.dataset.maxHeight || "", 10);
  if (!Number.isFinite(frameCount) || frameCount <= 0) return;

  const applyMetrics = () => {
    if (!spriteSheet.naturalWidth || !spriteSheet.naturalHeight) return;

    const cacheKey = [
      spriteSheet.currentSrc || spriteSheet.src,
      frameCount,
      maxDisplayWidth,
      maxDisplayHeight,
    ].join("::");
    const cachedMetrics = journeySpriteMetricsCache.get(cacheKey);
    const metrics =
      cachedMetrics ||
      buildJourneySpriteMetrics(
        spriteSheet,
        frameCount,
        Number.isFinite(maxDisplayWidth) ? maxDisplayWidth : JOURNEY_WALK_SPRITE.maxDisplayWidth,
        Number.isFinite(maxDisplayHeight)
          ? maxDisplayHeight
          : JOURNEY_WALK_SPRITE.maxDisplayHeight
      );

    if (!cachedMetrics) {
      journeySpriteMetricsCache.set(cacheKey, metrics);
    }

    const stage = spriteSheet.closest(".journey-sprite-stage");
    if (stage) {
      stage.style.setProperty("--journey-sprite-display-width", `${metrics.displayWidth}px`);
      stage.style.setProperty("--journey-sprite-display-height", `${metrics.displayHeight}px`);
    }

    spriteSheet.style.setProperty("--journey-sprite-sheet-width", `${metrics.sheetWidth}px`);
    spriteSheet.style.setProperty("--journey-sprite-sheet-height", `${metrics.sheetHeight}px`);
    spriteSheet.style.setProperty("--journey-sprite-offset-x", `${metrics.offsetX}px`);
    spriteSheet.style.setProperty("--journey-sprite-offset-y", `${metrics.offsetY}px`);
    spriteSheet.style.setProperty("--journey-sprite-shift", `${metrics.shift}px`);
    spriteSheet.style.animationTimingFunction = `steps(${frameCount})`;
    spriteSheet.style.animationDuration = `${
      (Number.isFinite(frameDurationMs) && frameDurationMs > 0
        ? frameDurationMs
        : JOURNEY_WALK_SPRITE.frameDurationMs) * frameCount
    }ms`;
  };

  if (spriteSheet.complete && spriteSheet.naturalWidth) {
    applyMetrics();
    return;
  }

  spriteSheet.addEventListener("load", applyMetrics, { once: true });
}

function buildJourneySpriteMetrics(
  spriteSheet,
  frameCount,
  maxDisplayWidth,
  maxDisplayHeight
) {
  const frameWidth = Math.floor(spriteSheet.naturalWidth / frameCount);
  const frameHeight = spriteSheet.naturalHeight;
  const cropBounds = detectJourneySpriteBounds(
    spriteSheet,
    frameWidth,
    frameHeight,
    frameCount
  );
  const displayScale = Math.min(
    1,
    maxDisplayWidth / cropBounds.width,
    maxDisplayHeight / cropBounds.height
  );
  const roundedScale = Number.isFinite(displayScale) && displayScale > 0 ? displayScale : 1;
  const displayWidth = Math.max(1, Math.round(cropBounds.width * roundedScale));
  const displayHeight = Math.max(1, Math.round(cropBounds.height * roundedScale));
  const renderedFrameWidth = Math.max(1, Math.round(frameWidth * roundedScale));

  return {
    displayWidth,
    displayHeight,
    sheetWidth: Math.max(1, Math.round(spriteSheet.naturalWidth * roundedScale)),
    sheetHeight: Math.max(1, Math.round(frameHeight * roundedScale)),
    offsetX: Math.round(cropBounds.x * roundedScale) * -1,
    offsetY: Math.round(cropBounds.y * roundedScale) * -1,
    shift: renderedFrameWidth * frameCount,
  };
}

function detectJourneySpriteBounds(spriteSheet, frameWidth, frameHeight, frameCount) {
  const canvas = document.createElement("canvas");
  canvas.width = spriteSheet.naturalWidth;
  canvas.height = frameHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return { x: 0, y: 0, width: frameWidth, height: frameHeight };
  }

  context.drawImage(spriteSheet, 0, 0);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const backgroundPalette = collectJourneySpriteBackgroundPalette(
    data,
    canvas.width,
    canvas.height
  );

  let minX = frameWidth;
  let minY = frameHeight;
  let maxX = -1;
  let maxY = -1;

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const frameOffsetX = frameIndex * frameWidth;

    for (let y = 0; y < frameHeight; y += 1) {
      for (let x = 0; x < frameWidth; x += 1) {
        const pixelIndex = ((y * canvas.width) + frameOffsetX + x) * 4;
        const red = data[pixelIndex];
        const green = data[pixelIndex + 1];
        const blue = data[pixelIndex + 2];
        const alpha = data[pixelIndex + 3];

        if (alpha <= JOURNEY_SPRITE_ALPHA_THRESHOLD) {
          continue;
        }

        if (matchesJourneySpriteBackground(red, green, blue, backgroundPalette)) {
          continue;
        }

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, width: frameWidth, height: frameHeight };
  }

  const paddedMinX = Math.max(0, minX - JOURNEY_SPRITE_BOUNDING_PADDING);
  const paddedMinY = Math.max(0, minY - JOURNEY_SPRITE_BOUNDING_PADDING);
  const paddedMaxX = Math.min(frameWidth - 1, maxX + JOURNEY_SPRITE_BOUNDING_PADDING);
  const paddedMaxY = Math.min(frameHeight - 1, maxY + JOURNEY_SPRITE_BOUNDING_PADDING);

  return {
    x: paddedMinX,
    y: paddedMinY,
    width: paddedMaxX - paddedMinX + 1,
    height: paddedMaxY - paddedMinY + 1,
  };
}

function collectJourneySpriteBackgroundPalette(imageData, width, height) {
  const colorCounts = new Map();
  const borderDepth = Math.min(18, Math.max(4, Math.floor(Math.min(width, height) / 20)));

  const countColor = (x, y) => {
    const pixelIndex = ((y * width) + x) * 4;
    const alpha = imageData[pixelIndex + 3];

    if (alpha <= JOURNEY_SPRITE_ALPHA_THRESHOLD) {
      return;
    }

    const key = `${imageData[pixelIndex]},${imageData[pixelIndex + 1]},${imageData[pixelIndex + 2]}`;
    colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
  };

  for (let y = 0; y < borderDepth; y += 1) {
    for (let x = 0; x < width; x += 1) {
      countColor(x, y);
      countColor(x, height - 1 - y);
    }
  }

  for (let x = 0; x < borderDepth; x += 1) {
    for (let y = borderDepth; y < height - borderDepth; y += 1) {
      countColor(x, y);
      countColor(width - 1 - x, y);
    }
  }

  return Array.from(colorCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([key]) => {
      const [red, green, blue] = key.split(",").map(Number);
      return { red, green, blue };
    });
}

function matchesJourneySpriteBackground(red, green, blue, backgroundPalette) {
  if (!backgroundPalette.length) return false;

  return backgroundPalette.some((color) => {
    const channelDistance =
      Math.abs(red - color.red) +
      Math.abs(green - color.green) +
      Math.abs(blue - color.blue);

    return channelDistance <= JOURNEY_SPRITE_BACKGROUND_TOLERANCE;
  });
}

export function getJourneyInventoryItems(state, supplies) {
  const locale = getCurrentLocale();
  const items = [
    locale === "ja"
      ? `最初の持ち物: ${getJourneyStarterItemLabel(state.starterItem)}`
      : `Starter keepsake: ${getJourneyStarterItemLabel(state.starterItem)}`,
  ];

  const equippedWeapon = getJourneyWeaponInventory(state).find((weapon) => weapon.equipped);
  if (equippedWeapon?.meta) {
    items.push(
      locale === "ja"
        ? `装備武器: ${getJourneyWeaponLabel(equippedWeapon.key, equippedWeapon.meta.label)}`
        : `Equipped weapon: ${getJourneyWeaponLabel(
            equippedWeapon.key,
            equippedWeapon.meta.label
          )}`
    );
  }

  if (state.storyFlags.boarDefeated) {
    items.push(locale === "ja" ? "猪の戦利品" : "Boar trophy");
  }

  if (supplies.availableRations > 0) {
    items.push(
      locale === "ja"
        ? `食料 ${supplies.availableRations}`
        : `${supplies.availableRations} ration${supplies.availableRations === 1 ? "" : "s"}`
    );
  }

  if (supplies.availableTonics > 0) {
    items.push(
      locale === "ja"
        ? `トニック ${supplies.availableTonics}`
        : `${supplies.availableTonics} tonic${supplies.availableTonics === 1 ? "" : "s"}`
    );
  }

  return items;
}

export function getJourneyKnownNotes(state) {
  const locale = getCurrentLocale();
  const notes = [];

  if (state.storyFlags.foundWeapon) {
    notes.push(
      locale === "ja"
        ? "もう完全に素手というわけではない。"
        : "You are no longer completely unarmed."
    );
  }

  if (state.bagKey && state.bagKey !== "none") {
    notes.push(
      locale === "ja"
        ? "より本格的な装備構成を持ち歩けるだけの収納ができた。"
        : "You have enough pack space now to carry a more serious loadout."
    );
  }

  if (state.storyFlags.boarDefeated) {
    notes.push(
      locale === "ja"
        ? "森での最初の苛烈な狩りを生き延びた。"
        : "You survived your first brutal hunt in the woods."
    );
  }

  if (state.storyFlags.slimeSapped) {
    notes.push(
      locale === "ja"
        ? "まずいスライム食で、身体に消えない負担が残った。"
        : "A bad slime meal left your body permanently worse for wear."
    );
  }

  for (const bonus of Array.isArray(state.permanentBonuses) ? state.permanentBonuses : []) {
    const statLabel = getJourneyStatLabel(bonus.statKey);
    notes.push(
      locale === "ja"
        ? `${bonus.title} の余韻が残っている: ${statLabel} ${bonus.amount > 0 ? "+" : ""}${bonus.amount}。`
        : `${bonus.title} lingers on you: ${statLabel} ${bonus.amount > 0 ? "+" : ""}${bonus.amount}.`
    );
  }

  if (state.unlockedClasses.length > 1) {
    notes.push(
      locale === "ja"
        ? `新たな系統が目覚めた: ${getJourneyClassLabel(state.classType)}。`
        : `A discipline awakened: ${getJourneyClassLabel(state.classType)}.`
    );
  }

  if ((state.pendingWeaponKeys || []).length) {
    notes.push(
      locale === "ja"
        ? "新しい武器が見つかっている。何を残して何を手放すか決める必要がある。"
        : "A fresh weapon find is waiting on you to decide what stays and what goes."
    );
  }

  return notes;
}
