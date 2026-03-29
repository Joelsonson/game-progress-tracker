const DEFAULT_LOCALE = "en";
const SUPPORTED_LOCALES = new Set(["en", "ja"]);

let activeLocale = DEFAULT_LOCALE;

const translations = {
  en: {
    app: {
      documentTitle: "Tabi no Kiroku — Journey Log",
    },
    brand: {
      eyebrow: "旅の記録",
      titleSub: "Journey Log",
    },
    nav: {
      home: "Home",
      journey: "Journey",
      character: "Character",
      tracker: "Tracker",
      sessions: "Sessions",
    },
    common: {
      unspecified: "Unspecified",
      never: "Never",
      noneSet: "None set",
      noneYet: "None yet",
      sessionWord: ({ count }) => (Number(count) === 1 ? "session" : "sessions"),
      gameWord: ({ count }) => (Number(count) === 1 ? "game" : "games"),
      dayWord: ({ count }) => (Number(count) === 1 ? "day" : "days"),
      close: "Close",
      settings: "Settings",
    },
    player: {
      rank: {
        sideQuestStarter: "Side Quest Starter",
        momentumBuilder: "Momentum Builder",
        focusedFinisher: "Focused Finisher",
        bossHunter: "Boss Hunter",
        legendaryFinisher: "Legendary Finisher",
      },
      nextLevelValue: ({ xp }) => `${xp} XP`,
      xpProgressText: ({ current, total, nextLevel }) =>
        `${current} / ${total} XP to level ${nextLevel}`,
    },
    difficulty: {
      notApplicable: "N/A",
      veryEasy: "Very Easy",
      easy: "Easy",
      standard: "Standard",
      hard: "Hard",
      veryHard: "Very Hard",
      preview: ({ difficulty, rewardXp }) =>
        `${difficulty} clear reward: +${rewardXp} XP when you finish it.`,
      previewNoReward: ({ difficulty }) =>
        `${difficulty} game. Track playtime and sessions without a clear reward.`,
    },
    home: {
      playerProgressEyebrow: "Player progression",
      focusEyebrow: "Current focus",
      focusTitle: "The game that should pull you back in",
      focusBody:
        "Your active quest should feel immediate, readable, and ready for the next session.",
      focusEmptyTitle: "Home works best when one game leads the page",
      focusEmptyBody:
        "Move something into In Progress and make it your Main Game to turn Home into a proper command deck.",
      snapshotEyebrow: "Snapshot",
      snapshotTitle: "The numbers worth checking",
      snapshotBody: "A compact look at momentum, volume, and what is currently anchored.",
      progressBody:
        "Every logged session pushes your tracker level forward and keeps the whole run moving.",
      actionsEyebrow: "Jump back in",
      actionsTitle: "Shortcuts for your next move",
      actionsBody: "Use the actions you are most likely to want on mobile without digging around.",
      recentWinEyebrow: "Recent finish",
      recentWinTitle: "Your latest completion",
      recentWinBody: "Keep your newest clear close so it still feels earned.",
      quickActionsTitle: "Quick actions",
      quickActionsBody:
        "Jump straight to the part of the tracker you want instead of scrolling through everything.",
      quickLogSession: "Log session",
      quickAddGame: "Add game",
      quickViewTracker: "View tracker",
      quickOpenJourney: "Open journey",
      quickCharacter: "Character",
      totalGames: "Total games",
      inProgress: "In progress",
      completed: "Completed",
      totalSessions: "Total sessions",
      mainGame: "Main game",
      currentStreak: "Current streak",
    },
    tracker: {
      title: "Your tracker",
      emptySummary: "No games saved yet.",
      emptyState: "Add your first game to start building a finishable list.",
      listSummary: ({ tracked, inProgress, completed, backlog }) =>
        `${tracked} tracked • ${inProgress} in progress • ${completed} completed • ${backlog} backlog`,
      sections: {
        mainTitle: "Main Game",
        mainDescription:
          "Your current focus target. Keep chipping away until it joins the completed shelf.",
        mainEmpty: "No main game set yet.",
        completedTitle: "Completed deck",
        completedDescription:
          "Finished games now live in a scrollable card shelf so they feel like actual unlocks instead of plain tracker rows.",
      },
      deckHint: "Swipe or tap through your finished cards",
      manageCard: "Manage card",
      actions: "Actions",
      actionSheetMeta: ({ platform, difficulty, rewardXp }) =>
        `${platform} • ${difficulty} • +${rewardXp} XP clear reward`,
      actionSheetMetaNoReward: ({ platform, difficulty }) =>
        `${platform} • ${difficulty} • no clear reward`,
      summaryPills: {
        questXp: ({ xp }) => `XP: ${xp}`,
        sessions: ({ count }) => `Sessions: ${count}`,
        playTime: ({ value }) => `Play time: ${value}`,
        meaningfulSessions: ({ count }) => `Meaningful sessions: ${count}`,
        lastPlayed: ({ value }) => `Last played: ${value}`,
        platform: ({ value }) => `Platform: ${value}`,
        difficulty: ({ value }) => `Difficulty: ${value}`,
        reward: ({ rewardXp }) => `Clear reward: +${rewardXp} XP`,
        rewardNone: "Clear reward: N/A",
      },
      notes: {
        currentObjective: "Current objective",
        latestSession: "Latest session",
        noSessionNote: "No session note yet.",
      },
      state: {
        completed: ({ date, rewardXp }) => `Finished on ${date} • +${rewardXp} XP`,
        completedNoReward: ({ date }) => `Finished on ${date} • no clear reward`,
        paused: ({ date }) => `Paused on ${date}`,
        dropped: ({ date }) => `Dropped on ${date}`,
      },
      actionsMenu: {
        markInProgress: "Mark In Progress",
        drop: "Drop",
        currentMainGame: "Current Main Game",
        makeMain: "Make Main",
        moveToBacklog: "Move to Backlog",
        pause: "Pause",
        complete: "Complete",
        resume: "Resume",
        playAgain: "Play Again",
        downloadCard: "Download Card",
        restart: "Restart",
        changeCover: "Change Cover",
        addCover: "Add Cover",
        changeBanner: "Change Banner",
        addBanner: "Add Banner",
        clearArt: "Clear Art",
      },
      completionSpotlight: {
        eyebrow: "Finish unlocked",
        title: "Completion card ready",
        meta: ({ date, sessions, sessionWord, playTime }) =>
          `Finished ${date} • ${sessions} ${sessionWord} • ${playTime} total play time`,
        note:
          "Your latest finished game now gets a collectible-style finish card with art, stats, and a printable PNG export.",
      },
      mainQuest: {
        eyebrow: "Main quest",
        emptyTitle: "No active quest yet",
        emptyBody: "Move one game into In Progress and make it your Main Game.",
        badge: "Main Game",
        heroMeta: ({ sessions, sessionWord, playTime, meaningful }) =>
          `${sessions} ${sessionWord} • ${playTime} played • ${meaningful} meaningful`,
        noObjective: "No current objective set yet.",
        noSessionNote: "No session note yet.",
      },
      completionCard: {
        finishedMeta: ({ platform, date }) => `${platform} • Finished ${date}`,
        totalPlayTime: "Total play time",
        sessions: "Sessions",
        totalXp: "Total XP",
        meaningful: "Meaningful",
        mainGame: "Main Game",
      },
    },
    status: {
      backlog: {
        label: "Backlog",
        description:
          "Ideas you want to keep around without pretending you are actively playing them.",
        empty: "Nothing in backlog right now.",
      },
      inProgress: {
        label: "In Progress",
        description: "Your active rotation. Keep this list small to protect focus.",
        empty: "Nothing active yet. Move one game out of backlog when you are ready.",
      },
      paused: {
        label: "Paused",
        description: "Games you have intentionally set aside for now.",
        empty: "Nothing is paused right now.",
      },
      completed: {
        label: "Completed",
        description: "Finished games live here. This is the section you are trying to grow.",
        empty: "No finished games yet. Your next one will look great here.",
      },
      dropped: {
        label: "Dropped",
        description: "Games you are done forcing. You can always rescue them later.",
        empty: "No dropped games right now.",
      },
      completionReplaySuffix: " (completed replay)",
    },
    sessions: {
      tabs: {
        log: "Log Session",
        newGame: "New Game +",
        history: "Session History",
      },
      logTitle: "Log a play session",
      logBody:
        "Session logging is for in-progress games and completed replays. Backlog, paused, and dropped games should be moved first.",
      gameLabel: "Game",
      gameEmpty: "Move a game to In Progress first",
      minutesLabel: "Minutes played",
      minutesPlaceholder: "60",
      noteLabel: "Session note",
      notePlaceholder: "What did you get done? Where did you stop?",
      objectiveLabel: "Update current objective",
      objectivePlaceholder: "Optional: update what you want to do next in this game",
      meaningfulLabel: "This session felt like meaningful progress",
      submit: "Log session",
      addGameSummary: "Add a game",
      addGameBody: "Choose whether this game has a finish line, then set it up for tracking.",
      historyTitle: "Session history",
      recentTitle: "Recent sessions",
      recentEmptySummary: "No sessions logged yet.",
      recentEmptyState: "Log your first session to start building momentum.",
      recentSingle: "Showing your 1 logged session.",
      historySummary: ({ total }) => `Showing all ${total} logged sessions.`,
      recentMany: ({ visible, total }) =>
        `Showing your latest ${visible} of ${total} sessions.`,
      showOlder: ({ count, sessionWord }) => `Show ${count} older ${sessionWord}`,
      card: {
        meaningful: "Meaningful progress",
        light: "Light session",
        sessionNote: "Session note",
        noNote: "No note for this session.",
        focusTax: "Focus tax",
      },
      messages: {
        noGameSelected: "Move a game into progress before logging sessions.",
        invalidMinutes: "Please enter a valid number of minutes.",
        gameNotFound: "That game could not be found.",
        needsInProgress: ({ title }) =>
          `${title} needs to be In Progress before you log another session.`,
        replaySuffix: " replay",
        focusTaxSuffix: ({ value }) => ` • Focus tax ${value}`,
        objectiveUpdatedSuffix: " • Objective updated.",
        logged: ({ duration, replayText, title, totalText, focusText, objectiveText }) =>
          `Logged ${duration}${replayText} for "${title}" • ${totalText}${focusText}${objectiveText}.`,
        saveFailed: "Could not save session.",
      },
    },
    games: {
      add: {
        title: "Add a game",
        titleLabel: "Game title",
        titlePlaceholder: "Elden Ring",
        platformLabel: "Platform",
        platformPlaceholder: "PC, PS5, Switch...",
        statusLabel: "Starting status",
        difficultyLabel: "Completion difficulty",
        difficultyHint:
          "Pick how demanding the full clear feels. Harder clears pay out more when completed.",
        noClearReward: "No clear XP",
        objectiveLabel: "Current objective",
        objectivePlaceholder:
          "Where you left off, your current goal, next objective...",
        coverLabel: "Cover art",
        coverHint:
          "Portrait art looks best. Recommended upload: 900×1200 or larger. The app crops it to a 3:4 card frame after upload.",
        bannerLabel: "Banner art",
        bannerHint:
          "Wide artwork works best. Recommended upload: 1600×900 or larger. The app crops it to a 16:9 hero frame after upload.",
        submit: "Add game",
        titleMissing: "Please enter a game title.",
        cropCancelled: "Image crop cancelled.",
        saveFailed: "Could not save game.",
        addedCompleted: ({ title, rewardXp }) =>
          `Added and finished "${title}". Nice. +${rewardXp} XP.`,
        addedMain: ({ title }) => `Added "${title}" as your Main Game.`,
        addedToStatus: ({ title, statusLabel }) =>
          `Added "${title}" to ${statusLabel}.`,
      },
      messages: {
        notFound: "That game could not be found.",
        makeMainRestricted: "Only in-progress games can be your Main Game.",
        nowMain: ({ title }) => `"${title}" is now your Main Game.`,
        clearedArt: ({ title }) => `Cleared artwork for "${title}".`,
        savedCard: ({ title }) => `Saved a completion card for "${title}".`,
        statusNotSupported: "That status change is not supported.",
        movedStatus: ({ title, statusLabel }) =>
          `Moved "${title}" to ${statusLabel}.`,
        cannotComplete: "This game is marked as non-completable, so it cannot be finished for clear XP.",
        updateFailed: "Could not update game.",
        artUpdated: ({ kindLabel, title }) =>
          `Updated ${kindLabel} for "${title}".`,
        artUpdateFailed: "Could not update game art.",
      },
      completionMessage: ({ title, playTime, sessions, sessionWord, rewardXp }) =>
        `🏆 Finished "${title}" — ${playTime} across ${sessions} ${sessionWord} • +${rewardXp} XP.`,
    },
    journey: {
      eyebrow: "Idle journey",
      title: "Another world, day by day",
      description:
        "Your character journeys on ahead. The more progress you make in games, the more he will push forward in his own journey.",
    },
    journeyUi: {
      common: {
        namelessWanderer: "Nameless Wanderer",
        health: "Health",
        hunger: "Hunger",
        hpShort: "HP",
        onRoad: "On the road",
        recovering: "Recovering",
      },
      home: {
        atGlance: "Journey at a glance",
        currentGoal: "Current goal",
        condition: "Condition",
        openJourney: "Open journey",
        newEvent: "New event",
      },
      modals: {
        thinkingTitle: "Carrying out your choice...",
        thinkingCopy: "The result is taking shape.",
        choose: "Choose",
        whatHappenedNext: "What happened next",
        succeeded: "Succeeded",
        failed: "Failed",
        chance: ({ value }) => `${value}% chance`,
        youChose: ({ label }) => `You chose: ${label}`,
        triedPrefix: "You tried:",
        roadAnswered: "The road answered your choice.",
        noVisibleChange: "Nothing shifted in a way you could clearly measure.",
        historyEyebrow: "Journey history",
        historyTitle: "Journey history",
        historyMeta: "A record of the road behind you.",
        historyEmptyTitle: "Nothing recorded yet",
        historyEmptyBody: "The road has not given you anything to file here yet.",
        untitledEntry: "Untitled entry",
      },
      page: {
        eventQueue: "Event queue",
        awaitingChoice: "Awaiting a choice",
        eventQueueBody: "Open an encounter when you are ready to deal with it.",
        quietStretch: "Quiet stretch",
        noImmediateEvent: "No immediate event",
        quietStretchBody:
          "Nothing urgent is waiting. For now, the road is only asking you to keep moving.",
        currentStretch: "Current stretch",
        eventWaiting: ({ count }) => `${count} event waiting`,
        currentGoal: "Current goal",
        nextDanger: "Next danger",
        travelPace: "Travel pace",
        travelPaceValue: ({ value }) => `${value}/hr`,
        expeditionFocus: "Expedition focus",
        expeditionFocusTitle: "Travel condition",
        roadsCleared: "Roads cleared",
        retreats: "Retreats",
        openLog: "Open log",
        latestEntry: ({ title }) => `Latest: ${title}`,
        openRoadLog: "Open the road log",
        openRetreatLog: "Open the retreat log",
        travelLog: "Travel log",
        recentEvents: "Recent events",
        recentEventsEmpty:
          "You have only just arrived. The first ugly lesson is coming.",
        roadNotes: "Road notes",
        roadNotesTitle: "What this stretch is asking of you",
        nextThreatEta: ({ value }) => `Rough ETA to the next threat: ${value}.`,
        learningWorld: "You are still learning this world the hard way.",
        debugTools: "Debug tools",
        debugBody:
          "Use these to test passive incidents, travel updates, and queued events without leaving this cleaner layout.",
        advance6h: "Advance 6h",
        advance24h: "Advance 24h",
        advance3d: "Advance 3d",
        forceEvent: "Force event",
        undoDebugStep: "Undo debug step",
        resetJourneyOnly: "Reset journey only",
      },
      character: {
        editCharacterName: "Edit character name",
        namePlaceholder: "Name your character",
        saveName: "Save name",
        loadout: "Loadout",
        loadoutTitle: "What is shaping this build",
        discipline: "Discipline",
        equippedWeapon: "Equipped weapon",
        stillUnarmed: "Still unarmed",
        bag: "Bag",
        starterKeepsake: "Starter keepsake",
        carryLimits: "Carry limits",
        carryLimitsValue: ({ weaponSlots, rationCapacity, tonicCapacity }) =>
          `${weaponSlots} weapon slot${Number(weaponSlots) === 1 ? "" : "s"}, ${rationCapacity} ration${Number(rationCapacity) === 1 ? "" : "s"}, ${tonicCapacity} tonic${Number(tonicCapacity) === 1 ? "" : "s"}`,
        inventory: "Inventory",
        inventoryTitle: "What you are carrying",
        weapons: "Weapons",
        rations: "Rations",
        tonics: "Tonics",
        useTonic: ({ count }) => `Use tonic (${count})`,
        eatRation: ({ count }) => `Eat ration (${count})`,
        travellingLight: "You are still travelling light and painfully under-armed.",
        autoConsumeNote:
          "Extra supplies beyond your bag space are automatically consumed on the road.",
        classDiscipline: "Class discipline",
        hiddenPaths:
          "Other paths are still hidden. They reveal themselves through the road, not the menu.",
        noDiscipline:
          "No discipline has awakened yet. You are still learning the rules of this world the hard way.",
        learnedBySurviving:
          "Most of what you know has been learned by surviving one ugly stretch at a time.",
        characterLevel: "Character level",
        pointsReady: ({ count }) => `${count} point${Number(count) === 1 ? "" : "s"} ready`,
        spendSkillPoints: "Spend skill points",
        levelLabel: ({ level }) => `Level ${level}`,
        xpProgress: ({ current, goal }) => `XP ${current} / ${goal}`,
        xpToNext: ({ remaining }) => `${remaining} XP to next level`,
        seeXpSources: "See XP sources",
        totalCharacterLevel: "Total character level",
        trackerLevelStoryBonus: ({ trackerLevel, storyBonus }) =>
          `Tracker level ${trackerLevel} + story bonus ${storyBonus}.`,
        trackerXp: "Tracker XP",
        storyXp: "Story XP",
        currentStoryBar: ({ current, total }) => `Current story bar ${current} / ${total}`,
        storyBonusValue: ({ value }) => `Story bonus +${value}`,
        levelUp: "Level up",
        levelTransition: ({ from, to }) => `Level ${from} > ${to}`,
        skillPointsAvailable: ({ count }) => `Skill points available: ${count}`,
        newFind: "New find",
        keepIt: "Keep it",
        swapWith: ({ weapon }) => `Swap with ${weapon}`,
        leaveIt: "Leave it",
        equipped: "Equipped",
        currentlyEquipped: "Currently equipped",
        equip: "Equip",
      },
      stats: {
        base: ({ value }) => `Base ${value}`,
        spent: ({ value }) => `Spent ${value}`,
        classBonus: ({ value }) => `Class +${value}`,
        weaponBonus: ({ value }) => `Weapon +${value}`,
        modifier: ({ value }) => `Modifier ${value}`,
        plusOne: ({ label }) => `+1 ${label}`,
      },
      progress: {
        recoveryComesFirst: "Recovery comes first",
      },
      radar: {
        ariaLabel:
          "Radar chart showing your Might, Finesse, Arcana, Vitality, and Resolve",
      },
      history: {
        expeditionFocusEyebrow: "Expedition focus",
        roadsClearedTitle: "Roads cleared",
        roadsClearedMetaEmpty: "No stretches cleared yet.",
        roadsClearedMeta: ({ count }) =>
          `${count} cleared ${Number(count) === 1 ? "road" : "roads"} so far.`,
        clearedStretch: "Cleared stretch",
        noRoadClearsTitle: "No road clears logged yet",
        noRoadClearsBody:
          "Win a stretch and it will show up here with its timestamp.",
        noRoadClearsLegacyBody:
          "Some earlier progress predates the detailed road log, so only newer clears will appear here.",
        retreatsTitle: "Retreats",
        retreatsMetaEmpty: "You have not had to fall back yet.",
        retreatsMeta: ({ count }) =>
          `${count} ${Number(count) === 1 ? "retreat" : "retreats"} recorded so far.`,
        fallback: "Fallback",
        noRetreatsTitle: "No retreats logged yet",
        noRetreatsBody:
          "If the road forces you to fall back, it will be recorded here.",
        noRetreatsLegacyBody:
          "Some earlier retreats predate the detailed log, so only newer ones will appear here.",
      },
    },
    settings: {
      summary: "Settings & data",
      modalBody: "Theme, language, backups, and local data tools all live here now.",
      appearanceEyebrow: "Appearance",
      appearanceTitle: "Choose your reading mode",
      appearanceBody: "Switch between light, dark, or follow your device setting.",
      themeLabel: "Theme",
      themeSystem: "Match device",
      themeLight: "Light",
      themeDark: "Dark",
      languageEyebrow: "Language",
      languageTitle: "Choose your interface language",
      languageBody:
        "Switch the app between English and Japanese. Dates and interface labels will update right away.",
      languageLabel: "Language",
      languageEn: "English",
      languageJa: "Japanese",
      artEyebrow: "Artwork guide",
      artTitle: "Better-looking cards start with the right framing",
      artBody:
        "Covers should be portrait and readable even when small. Banners should keep the subject near the center so the hero panels and deck cards still look clean on smaller screens.",
      artCover: "Cover: 3:4 portrait",
      artBanner: "Banner: 16:9 wide",
      artCrop: "Crop editor included",
      backupEyebrow: "Local backup",
      backupTitle: "Move your tracker to another device",
      backupBody:
        "Export saves your games, sessions, XP progress, artwork, and idle journey into one JSON backup. Import replaces the current local tracker with the backup you choose.",
      export: "Export progress",
      import: "Import progress",
      resetJourney: "Reset journey only",
      clearData: "Clear all data",
      exportSuccess: ({ games, sessions }) =>
        `Exported ${games} games, ${sessions} sessions, and your idle journey.`,
      importSuccess: ({ games, sessions }) =>
        `Imported ${games} games, ${sessions} sessions, and your idle journey.`,
      clearSuccess: "Cleared all local tracker data.",
      resetJourneySuccess: "Idle journey reset. Tracker history kept.",
      invalidImport: "Please choose a valid exported JSON backup.",
      exportFailed: "Could not export your progress.",
      importFailed: "Could not import that backup file.",
      clearFailed: "Could not clear your local data.",
      resetJourneyFailed: "Could not reset the idle journey.",
      clearConfirm:
        "Clear all games, sessions, art, XP progress, and idle journey data from this device?",
      resetJourneyConfirm:
        "Reset only the idle journey and keep your games, sessions, and records?",
    },
    crop: {
      eyebrow: "Adjust artwork",
      title: "Crop image",
      guidance: "Position the image so the important area stays visible.",
      zoom: "Zoom",
      horizontal: "Horizontal crop",
      vertical: "Vertical crop",
      reset: "Reset",
      cancel: "Cancel",
      confirm: "Use crop",
      preset: "Preset",
    },
    footer: {
      title: "Settings",
      body: "Theme, language, backup",
      button: "Open settings",
    },
    messages: {
      initError: "Could not initialize the app.",
    },
  },
  ja: {
    app: {
      documentTitle: "旅の記録 — Journey Log",
    },
    brand: {
      eyebrow: "旅の記録",
      titleSub: "Journey Log",
    },
    nav: {
      home: "ホーム",
      journey: "旅路",
      character: "キャラ",
      tracker: "トラッカー",
      sessions: "セッション",
    },
    common: {
      unspecified: "未設定",
      never: "未プレイ",
      noneSet: "未設定",
      noneYet: "まだなし",
      sessionWord: () => "回",
      gameWord: () => "本",
      dayWord: () => "日",
      close: "閉じる",
      settings: "設定",
    },
    player: {
      rank: {
        sideQuestStarter: "寄り道ビギナー",
        momentumBuilder: "勢いづく旅人",
        focusedFinisher: "集中フィニッシャー",
        bossHunter: "ボスハンター",
        legendaryFinisher: "伝説の完走者",
      },
      nextLevelValue: ({ xp }) => `あと ${xp} XP`,
      xpProgressText: ({ current, total, nextLevel }) =>
        `レベル${nextLevel}まで ${current} / ${total} XP`,
    },
    difficulty: {
      notApplicable: "対象外",
      veryEasy: "とても簡単",
      easy: "簡単",
      standard: "標準",
      hard: "難しい",
      veryHard: "とても難しい",
      preview: ({ difficulty, rewardXp }) =>
        `${difficulty}クリア: 完了時に +${rewardXp} XP`,
      previewNoReward: ({ difficulty }) =>
        `${difficulty}のゲームです。クリア報酬なしでプレイ時間とセッションを記録します。`,
    },
    home: {
      playerProgressEyebrow: "プレイヤー進行度",
      focusEyebrow: "現在の焦点",
      focusTitle: "いま最優先で戻りたいゲーム",
      focusBody:
        "ホームでは、次に遊ぶべき一本がすぐ見えて、そのまま続きを始められる状態が理想です。",
      focusEmptyTitle: "ホームは一本の主軸があると使いやすくなります",
      focusEmptyBody:
        "ゲームを「進行中」にしてメインゲームへ設定すると、ホームがきちんとした司令塔になります。",
      snapshotEyebrow: "スナップショット",
      snapshotTitle: "確認したい数字だけ",
      snapshotBody: "勢い、進捗量、今どこに集中しているかを短くまとめて確認できます。",
      progressBody:
        "セッションを記録するたびに、トラッカーのレベルも全体の流れも少しずつ前へ進みます。",
      actionsEyebrow: "すぐ再開",
      actionsTitle: "次の一手への近道",
      actionsBody: "モバイルで欲しい操作をすぐ押せるようにまとめました。",
      recentWinEyebrow: "最近の完了",
      recentWinTitle: "最新のクリア",
      recentWinBody: "直近の完了をすぐ見返せるようにして、達成感を残します。",
      quickActionsTitle: "クイック操作",
      quickActionsBody:
        "スクロールせずに、使いたい画面へすぐ移動できます。",
      quickLogSession: "記録する",
      quickAddGame: "ゲーム追加",
      quickViewTracker: "一覧を見る",
      quickOpenJourney: "旅路を開く",
      quickCharacter: "キャラ",
      totalGames: "総ゲーム数",
      inProgress: "進行中",
      completed: "完了",
      totalSessions: "総セッション数",
      mainGame: "メインゲーム",
      currentStreak: "連続日数",
    },
    tracker: {
      title: "トラッカー",
      emptySummary: "ゲームはまだありません。",
      emptyState: "最初のゲームを追加して、完了できる一覧を作りましょう。",
      listSummary: ({ tracked, inProgress, completed, backlog }) =>
        `${tracked}本登録 • 進行中 ${inProgress} • 完了 ${completed} • 積み ${backlog}`,
      sections: {
        mainTitle: "メインゲーム",
        mainDescription: "今いちばん集中して進める対象です。完了棚に送るまで少しずつ進めましょう。",
        mainEmpty: "メインゲームはまだありません。",
        completedTitle: "完了デッキ",
        completedDescription:
          "完了したゲームは、ただの行ではなく実績カードのように並びます。",
      },
      deckHint: "スワイプまたはタップで完了カードを確認",
      manageCard: "カード管理",
      actions: "操作",
      actionSheetMeta: ({ platform, difficulty, rewardXp }) =>
        `${platform} • ${difficulty} • クリア報酬 +${rewardXp} XP`,
      actionSheetMetaNoReward: ({ platform, difficulty }) =>
        `${platform} • ${difficulty} • クリア報酬なし`,
      summaryPills: {
        questXp: ({ xp }) => `XP: ${xp}`,
        sessions: ({ count }) => `セッション: ${count}`,
        playTime: ({ value }) => `プレイ時間: ${value}`,
        meaningfulSessions: ({ count }) => `良い進捗: ${count}`,
        lastPlayed: ({ value }) => `最終プレイ: ${value}`,
        platform: ({ value }) => `機種: ${value}`,
        difficulty: ({ value }) => `難易度: ${value}`,
        reward: ({ rewardXp }) => `クリア報酬: +${rewardXp} XP`,
        rewardNone: "クリア報酬: 対象外",
      },
      notes: {
        currentObjective: "現在の目標",
        latestSession: "最新セッション",
        noSessionNote: "セッションメモはまだありません。",
      },
      state: {
        completed: ({ date, rewardXp }) => `${date} に完了 • +${rewardXp} XP`,
        completedNoReward: ({ date }) => `${date} に完了 • クリア報酬なし`,
        paused: ({ date }) => `${date} に一時停止`,
        dropped: ({ date }) => `${date} に中断`,
      },
      actionsMenu: {
        markInProgress: "進行中にする",
        drop: "中断する",
        currentMainGame: "現在のメインゲーム",
        makeMain: "メインにする",
        moveToBacklog: "積みに戻す",
        pause: "一時停止",
        complete: "完了",
        resume: "再開",
        playAgain: "再プレイ",
        downloadCard: "カード保存",
        restart: "やり直す",
        changeCover: "カバー変更",
        addCover: "カバー追加",
        changeBanner: "バナー変更",
        addBanner: "バナー追加",
        clearArt: "アート削除",
      },
      completionSpotlight: {
        eyebrow: "完了アンロック",
        title: "完了カードを作成できます",
        meta: ({ date, sessions, playTime }) =>
          `${date} に完了 • ${sessions}回 • 総プレイ ${playTime}`,
        note:
          "最新の完了ゲームには、アート・統計・PNG出力付きのコレクションカードが用意されます。",
      },
      mainQuest: {
        eyebrow: "メインクエスト",
        emptyTitle: "アクティブな目標はまだありません",
        emptyBody: "ゲームを1本「進行中」にして、メインゲームに設定しましょう。",
        badge: "メインゲーム",
        heroMeta: ({ sessions, playTime, meaningful }) =>
          `${sessions}回 • ${playTime} プレイ • 有意義 ${meaningful}`,
        noObjective: "現在の目標はまだありません。",
        noSessionNote: "セッションメモはまだありません。",
      },
      completionCard: {
        finishedMeta: ({ platform, date }) => `${platform} • ${date} 完了`,
        totalPlayTime: "総プレイ時間",
        sessions: "セッション数",
        totalXp: "総XP",
        meaningful: "良い進捗",
        mainGame: "メインゲーム",
      },
    },
    status: {
      backlog: {
        label: "積み",
        description: "今すぐ遊ぶとは決めていないけれど、残しておきたいゲームです。",
        empty: "積みは空です。",
      },
      inProgress: {
        label: "進行中",
        description: "今遊んでいる作品です。集中を守るため、ここは少なめが理想です。",
        empty: "進行中はまだありません。準備ができたら積みから1本動かしましょう。",
      },
      paused: {
        label: "一時停止",
        description: "いったん意図的に止めているゲームです。",
        empty: "一時停止中のゲームはありません。",
      },
      completed: {
        label: "完了",
        description: "完了したゲームが並ぶ場所です。ここを育てていきましょう。",
        empty: "まだ完了したゲームはありません。次の1本がここに並びます。",
      },
      dropped: {
        label: "中断",
        description: "無理に続けるのをやめたゲームです。あとで戻ることもできます。",
        empty: "中断したゲームはありません。",
      },
      completionReplaySuffix: "（クリア後の再プレイ）",
    },
    sessions: {
      tabs: {
        log: "記録する",
        newGame: "ゲーム追加 +",
        history: "履歴",
      },
      logTitle: "プレイセッションを記録",
      logBody:
        "セッション記録は「進行中」と「完了後の再プレイ」向けです。積み・一時停止・中断は先に状態を変えてください。",
      gameLabel: "ゲーム",
      gameEmpty: "まずゲームを進行中にしてください",
      minutesLabel: "プレイ時間（分）",
      minutesPlaceholder: "60",
      noteLabel: "セッションメモ",
      notePlaceholder: "何が進んだ？ どこで止めた？",
      objectiveLabel: "現在の目標を更新",
      objectivePlaceholder: "任意: 次にやることを更新",
      meaningfulLabel: "今回はしっかり進んだと感じた",
      submit: "記録する",
      addGameSummary: "ゲームを追加",
      addGameBody: "このゲームに終わりがあるかを選んでから、追跡内容を設定します。",
      historyTitle: "セッション履歴",
      recentTitle: "最近のセッション",
      recentEmptySummary: "セッションはまだありません。",
      recentEmptyState: "最初のセッションを記録して勢いを作りましょう。",
      recentSingle: "記録済みの1件を表示中です。",
      historySummary: ({ total }) => `記録済み ${total} 件をすべて表示中です。`,
      recentMany: ({ visible, total }) =>
        `最新 ${visible} 件 / 全 ${total} 件を表示中です。`,
      showOlder: ({ count }) => `過去の ${count} 件を表示`,
      card: {
        meaningful: "しっかり進んだ",
        light: "軽めの回",
        sessionNote: "セッションメモ",
        noNote: "メモはありません。",
        focusTax: "集中ペナルティ",
      },
      messages: {
        noGameSelected: "セッションを記録する前に、ゲームを進行中にしてください。",
        invalidMinutes: "有効なプレイ時間を入力してください。",
        gameNotFound: "そのゲームが見つかりませんでした。",
        needsInProgress: ({ title }) =>
          `「${title}」は次の記録前に進行中にしておく必要があります。`,
        replaySuffix: " の再プレイ",
        focusTaxSuffix: ({ value }) => ` • 集中ペナルティ ${value}`,
        objectiveUpdatedSuffix: " • 目標を更新しました",
        logged: ({ duration, replayText, title, totalText, focusText, objectiveText }) =>
          `「${title}」に ${duration}${replayText} を記録 • ${totalText}${focusText}${objectiveText}。`,
        saveFailed: "セッションを保存できませんでした。",
      },
    },
    games: {
      add: {
        title: "ゲームを追加",
        titleLabel: "ゲームタイトル",
        titlePlaceholder: "Elden Ring",
        platformLabel: "機種",
        platformPlaceholder: "PC, PS5, Switch...",
        statusLabel: "開始状態",
        difficultyLabel: "クリア難易度",
        difficultyHint:
          "全体のクリア難度を選びます。難しいほど完了時の報酬が増えます。",
        noClearReward: "クリアXPなし",
        objectiveLabel: "現在の目標",
        objectivePlaceholder:
          "どこで止めたか、今の目標、次にやること…",
        coverLabel: "カバー画像",
        coverHint:
          "縦長の画像がおすすめです。推奨: 900×1200以上。アップロード後に3:4カード枠へ切り抜かれます。",
        bannerLabel: "バナー画像",
        bannerHint:
          "横長の画像がおすすめです。推奨: 1600×900以上。アップロード後に16:9ヒーロー枠へ切り抜かれます。",
        submit: "追加する",
        titleMissing: "ゲームタイトルを入力してください。",
        cropCancelled: "画像の切り抜きをキャンセルしました。",
        saveFailed: "ゲームを保存できませんでした。",
        addedCompleted: ({ title, rewardXp }) =>
          `「${title}」を追加して完了にしました。 +${rewardXp} XP`,
        addedMain: ({ title }) => `「${title}」をメインゲームとして追加しました。`,
        addedToStatus: ({ title, statusLabel }) =>
          `「${title}」を「${statusLabel}」に追加しました。`,
      },
      messages: {
        notFound: "そのゲームが見つかりませんでした。",
        makeMainRestricted: "メインゲームにできるのは進行中のゲームだけです。",
        nowMain: ({ title }) => `「${title}」をメインゲームにしました。`,
        clearedArt: ({ title }) => `「${title}」のアートを削除しました。`,
        savedCard: ({ title }) => `「${title}」の完了カードを保存しました。`,
        statusNotSupported: "その状態変更はサポートされていません。",
        movedStatus: ({ title, statusLabel }) =>
          `「${title}」を「${statusLabel}」へ移動しました。`,
        cannotComplete: "このゲームは非クリア型として登録されているため、クリア報酬付きの完了にはできません。",
        updateFailed: "ゲームを更新できませんでした。",
        artUpdated: ({ kindLabel, title }) =>
          `「${title}」の${kindLabel}を更新しました。`,
        artUpdateFailed: "ゲームアートを更新できませんでした。",
      },
      completionMessage: ({ title, playTime, sessions, rewardXp }) =>
        `🏆 「${title}」を完了 — ${playTime} / ${sessions}回 • +${rewardXp} XP`,
    },
    journey: {
      eyebrow: "放置旅路",
      title: "異世界を、毎日少しずつ",
      description:
        "あなたのゲーム進捗に合わせて、キャラクターも自分の旅を進めていきます。",
    },
    journeyUi: {
      common: {
        namelessWanderer: "名もなき旅人",
        health: "体力",
        hunger: "空腹",
        hpShort: "HP",
        onRoad: "旅の途中",
        recovering: "療養中",
      },
      home: {
        atGlance: "旅路のひと目まとめ",
        currentGoal: "現在の目標",
        condition: "状態",
        openJourney: "旅路を開く",
        newEvent: "新しい出来事",
      },
      modals: {
        thinkingTitle: "選んだ行動を進めています...",
        thinkingCopy: "結果がまとまりつつあります。",
        choose: "選ぶ",
        whatHappenedNext: "その後どうなったか",
        succeeded: "成功",
        failed: "失敗",
        chance: ({ value }) => `成功率 ${value}%`,
        youChose: ({ label }) => `選択: ${label}`,
        triedPrefix: "試したこと:",
        roadAnswered: "道はあなたの選択に応えた。",
        noVisibleChange: "はっきり測れる変化は起きなかった。",
        historyEyebrow: "旅の記録",
        historyTitle: "旅の記録",
        historyMeta: "ここまで歩いてきた道の記録です。",
        historyEmptyTitle: "まだ記録はありません",
        historyEmptyBody: "ここに残る出来事はまだありません。",
        untitledEntry: "無題の記録",
      },
      page: {
        eventQueue: "保留中の出来事",
        awaitingChoice: "選択待ち",
        eventQueueBody: "対応する準備ができたら、遭遇を開いてください。",
        quietStretch: "静かな道のり",
        noImmediateEvent: "急ぎの出来事なし",
        quietStretchBody:
          "差し迫ったことはありません。今はただ進み続けることが求められています。",
        currentStretch: "現在の区間",
        eventWaiting: ({ count }) => `${count}件の出来事が待機中`,
        currentGoal: "現在の目標",
        nextDanger: "次の脅威",
        travelPace: "移動速度",
        travelPaceValue: ({ value }) => `時速 ${value}`,
        expeditionFocus: "遠征フォーカス",
        expeditionFocusTitle: "旅の状態",
        roadsCleared: "踏破した道",
        retreats: "撤退",
        openLog: "記録を開く",
        latestEntry: ({ title }) => `最新: ${title}`,
        openRoadLog: "道の記録を見る",
        openRetreatLog: "撤退記録を見る",
        travelLog: "旅の記録",
        recentEvents: "最近の出来事",
        recentEventsEmpty:
          "まだ来たばかりだ。最初の厄介な洗礼はこれからやってくる。",
        roadNotes: "道中メモ",
        roadNotesTitle: "この区間で求められていること",
        nextThreatEta: ({ value }) => `次の脅威までの目安: ${value}。`,
        learningWorld: "この世界のことは、まだ痛い目を見ながら学んでいる最中だ。",
        debugTools: "デバッグツール",
        debugBody:
          "このレイアウトのまま、受動イベントや旅の進行、待機中イベントを確認できます。",
        advance6h: "6時間進める",
        advance24h: "24時間進める",
        advance3d: "3日進める",
        forceEvent: "イベント発生",
        undoDebugStep: "デバッグを元に戻す",
        resetJourneyOnly: "旅路だけリセット",
      },
      character: {
        editCharacterName: "キャラ名を編集",
        namePlaceholder: "キャラクター名を入力",
        saveName: "名前を保存",
        loadout: "装備構成",
        loadoutTitle: "このビルドを形づくるもの",
        discipline: "系統",
        equippedWeapon: "装備武器",
        stillUnarmed: "まだ素手",
        bag: "バッグ",
        starterKeepsake: "最初の持ち物",
        carryLimits: "所持上限",
        carryLimitsValue: ({ weaponSlots, rationCapacity, tonicCapacity }) =>
          `武器 ${weaponSlots}枠、食料 ${rationCapacity}、トニック ${tonicCapacity}`,
        inventory: "持ち物",
        inventoryTitle: "いま携えているもの",
        weapons: "武器",
        rations: "食料",
        tonics: "トニック",
        useTonic: ({ count }) => `トニックを使う (${count})`,
        eatRation: ({ count }) => `食料を食べる (${count})`,
        travellingLight: "まだ荷物は少なく、武装も心もとない。",
        autoConsumeNote:
          "バッグ容量を超えた予備品は、道中で自動的に消費されます。",
        classDiscipline: "クラス系統",
        hiddenPaths:
          "ほかの道はまだ隠されています。道そのものが明かしてくれるのであって、メニューではありません。",
        noDiscipline:
          "まだどの系統も目覚めていません。この世界の理を体で覚えている最中です。",
        learnedBySurviving:
          "知っていることの大半は、ひどい道のりを生き延びながら身につけたものです。",
        characterLevel: "キャラレベル",
        pointsReady: ({ count }) => `${count}ポイント割り振り可能`,
        spendSkillPoints: "スキルポイントを使う",
        levelLabel: ({ level }) => `レベル ${level}`,
        xpProgress: ({ current, goal }) => `XP ${current} / ${goal}`,
        xpToNext: ({ remaining }) => `次のレベルまで ${remaining} XP`,
        seeXpSources: "XPの内訳を見る",
        totalCharacterLevel: "総キャラレベル",
        trackerLevelStoryBonus: ({ trackerLevel, storyBonus }) =>
          `トラッカーレベル ${trackerLevel} + 物語補正 ${storyBonus}。`,
        trackerXp: "トラッカーXP",
        storyXp: "物語XP",
        currentStoryBar: ({ current, total }) => `現在の物語ゲージ ${current} / ${total}`,
        storyBonusValue: ({ value }) => `物語補正 +${value}`,
        levelUp: "レベルアップ",
        levelTransition: ({ from, to }) => `レベル ${from} > ${to}`,
        skillPointsAvailable: ({ count }) => `使えるスキルポイント: ${count}`,
        newFind: "新しい発見",
        keepIt: "持っていく",
        swapWith: ({ weapon }) => `${weapon}と入れ替え`,
        leaveIt: "置いていく",
        equipped: "装備中",
        currentlyEquipped: "現在装備中",
        equip: "装備する",
      },
      stats: {
        base: ({ value }) => `基本 ${value}`,
        spent: ({ value }) => `振り分け ${value}`,
        classBonus: ({ value }) => `クラス +${value}`,
        weaponBonus: ({ value }) => `武器 +${value}`,
        modifier: ({ value }) => `補正 ${value}`,
        plusOne: ({ label }) => `${label} +1`,
      },
      progress: {
        recoveryComesFirst: "まずは立て直しが先だ",
      },
      radar: {
        ariaLabel:
          "筋力、技巧、秘術、生命力、意志のレーダーチャート",
      },
      history: {
        expeditionFocusEyebrow: "遠征フォーカス",
        roadsClearedTitle: "踏破した道",
        roadsClearedMetaEmpty: "まだ踏破した区間はありません。",
        roadsClearedMeta: ({ count }) => `これまでに ${count} 区間を踏破しました。`,
        clearedStretch: "踏破した区間",
        noRoadClearsTitle: "踏破記録はまだありません",
        noRoadClearsBody:
          "一区間を乗り切れば、ここに時刻つきで記録されます。",
        noRoadClearsLegacyBody:
          "古い進捗は詳細ログ以前のものなので、ここには新しい踏破記録だけが表示されます。",
        retreatsTitle: "撤退",
        retreatsMetaEmpty: "まだ退く必要はありませんでした。",
        retreatsMeta: ({ count }) => `これまでに ${count} 回の撤退を記録しています。`,
        fallback: "後退",
        noRetreatsTitle: "撤退記録はまだありません",
        noRetreatsBody:
          "道に押し返されたときは、ここに記録されます。",
        noRetreatsLegacyBody:
          "古い撤退は詳細ログ以前のものなので、ここには新しい撤退記録だけが表示されます。",
      },
    },
    settings: {
      summary: "設定とデータ",
      modalBody: "テーマ、言語、バックアップ、ローカルデータ操作をここにまとめました。",
      appearanceEyebrow: "見た目",
      appearanceTitle: "表示テーマを選ぶ",
      appearanceBody: "ライト、ダーク、または端末設定に合わせて切り替えます。",
      themeLabel: "テーマ",
      themeSystem: "端末に合わせる",
      themeLight: "ライト",
      themeDark: "ダーク",
      languageEyebrow: "言語",
      languageTitle: "表示言語を選ぶ",
      languageBody: "英語と日本語を切り替えられます。日付やUI表記もすぐ反映されます。",
      languageLabel: "言語",
      languageEn: "English",
      languageJa: "日本語",
      artEyebrow: "アートガイド",
      artTitle: "見栄えの良いカードは構図から",
      artBody:
        "カバーは小さくても読める縦画像がおすすめです。バナーは被写体を中央寄りにすると、小さな画面でも綺麗に見えます。",
      artCover: "カバー: 3:4 縦長",
      artBanner: "バナー: 16:9 横長",
      artCrop: "切り抜きエディタ付き",
      backupEyebrow: "ローカルバックアップ",
      backupTitle: "別の端末へ移行",
      backupBody:
        "エクスポートすると、ゲーム・セッション・XP進行・アート・放置旅路を1つのJSONに保存します。インポートすると現在のローカルデータをそのバックアップで置き換えます。",
      export: "進捗を書き出す",
      import: "進捗を読み込む",
      resetJourney: "旅路だけリセット",
      clearData: "全データ削除",
      exportSuccess: ({ games, sessions }) =>
        `${games}本のゲーム、${sessions}件のセッション、旅路データをエクスポートしました。`,
      importSuccess: ({ games, sessions }) =>
        `${games}本のゲーム、${sessions}件のセッション、旅路データをインポートしました。`,
      clearSuccess: "ローカルのトラッカーデータをすべて削除しました。",
      resetJourneySuccess: "旅路をリセットしました。トラッカー履歴は保持されています。",
      invalidImport: "有効なJSONバックアップを選んでください。",
      exportFailed: "進捗をエクスポートできませんでした。",
      importFailed: "そのバックアップをインポートできませんでした。",
      clearFailed: "ローカルデータを削除できませんでした。",
      resetJourneyFailed: "旅路をリセットできませんでした。",
      clearConfirm:
        "この端末の全ゲーム・セッション・アート・XP進行・放置旅路データを削除しますか？",
      resetJourneyConfirm:
        "ゲームやセッション履歴は残したまま、放置旅路だけをリセットしますか？",
    },
    crop: {
      eyebrow: "アート調整",
      title: "画像を切り抜く",
      guidance: "大事な部分が見えるように位置を調整してください。",
      zoom: "ズーム",
      horizontal: "横位置",
      vertical: "縦位置",
      reset: "リセット",
      cancel: "キャンセル",
      confirm: "この切り抜きを使う",
      preset: "プリセット",
    },
    footer: {
      title: "設定",
      body: "テーマ・言語・バックアップ",
      button: "設定を開く",
    },
    messages: {
      initError: "アプリを初期化できませんでした。",
    },
  },
};

function getTranslationValue(locale, key) {
  const segments = String(key || "").split(".");
  let value = translations[locale];

  for (const segment of segments) {
    value = value?.[segment];
    if (value == null) {
      return undefined;
    }
  }

  return value;
}

export function normalizeLocale(locale) {
  return SUPPORTED_LOCALES.has(locale) ? locale : DEFAULT_LOCALE;
}

export function setActiveLocale(locale) {
  activeLocale = normalizeLocale(locale);
}

export function getCurrentLocale() {
  return activeLocale;
}

export function t(key, params = {}) {
  const locale = getCurrentLocale();
  const value =
    getTranslationValue(locale, key) ?? getTranslationValue(DEFAULT_LOCALE, key) ?? key;

  if (typeof value === "function") {
    return String(value(params));
  }

  return String(value).replace(/\{(\w+)\}/g, (_, token) =>
    params[token] == null ? "" : String(params[token])
  );
}

export function applyStaticTranslations(root = document) {
  if (!root?.querySelectorAll) return;

  document.documentElement.lang = getCurrentLocale();
  document.title = t("app.documentTitle");

  for (const element of root.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }

  for (const element of root.querySelectorAll("[data-i18n-placeholder]")) {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
  }

  for (const element of root.querySelectorAll("[data-i18n-aria-label]")) {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  }

  for (const element of root.querySelectorAll("[data-i18n-title]")) {
    element.setAttribute("title", t(element.dataset.i18nTitle));
  }
}
