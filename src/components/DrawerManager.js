import {h, Component} from 'preact'
import sabaki from '../modules/sabaki.js'
import {getRootProperty} from '../modules/gametree.js'

import InfoDrawer from './drawers/InfoDrawer.js'
import ScoreDrawer from './drawers/ScoreDrawer.js'
import PreferencesDrawer from './drawers/PreferencesDrawer.js'
import GameChooserDrawer from './drawers/GameChooserDrawer.js'
import CleanMarkupDrawer from './drawers/CleanMarkupDrawer.js'
import AdvancedPropertiesDrawer from './drawers/AdvancedPropertiesDrawer.js'

export default class DrawerManager extends Component {
  constructor() {
    super()

    this.handleScoreSubmit = ({resultString}) => {
      let gameTree = this.props.gameTrees[this.props.gameIndex]
      let newTree = gameTree.mutate((draft) => {
        draft.updateProperty(draft.root.id, 'RE', [resultString])
      })

      sabaki.setCurrentTreePosition(newTree, this.props.treePosition)
      sabaki.closeDrawer()
      setTimeout(() => sabaki.setMode('play'), 500)
    }

    this.handleGameSelect = ({selectedTree}) => {
      sabaki.closeDrawer()
      sabaki.setMode('play')
      sabaki.setCurrentTreePosition(selectedTree, selectedTree.root.id)
    }

    this.handleGameTreesChange = (evt) => {
      let {gameTrees, gameCurrents, gameIndex} = this.props
      let newGameTrees = evt.gameTrees || gameTrees
      let newGameDirectories = evt.gameDirectories || this.props.gameDirectories
      let newGameTreeDirectories =
        evt.gameTreeDirectories || this.props.gameTreeDirectories

      let treeIds = new Set(newGameTrees.map((tree) => String(tree.id)))
      newGameTreeDirectories = Object.fromEntries(
        Object.entries(newGameTreeDirectories || {}).filter(([id]) =>
          treeIds.has(id),
        ),
      )
      let tree = gameTrees[gameIndex]
      let newIndex = newGameTrees.findIndex((t) => t.root.id === tree.root.id)

      if (newIndex < 0) {
        if (newGameTrees.length === 0)
          newGameTrees = [sabaki.getEmptyGameTree()]

        newIndex = Math.min(Math.max(gameIndex - 1, 0), newGameTrees.length - 1)
        tree = newGameTrees[newIndex]
      }

      sabaki.setState({
        gameTrees: newGameTrees,
        gameDirectories: newGameDirectories,
        gameTreeDirectories: newGameTreeDirectories,
        gameCurrents: newGameTrees.map((tree, i) => {
          let oldIndex = gameTrees.findIndex((t) => t.root.id === tree.root.id)
          if (oldIndex < 0) return {}

          return gameCurrents[oldIndex]
        }),
      })

      sabaki.setCurrentTreePosition(tree, tree.root.id)
    }
  }

  render({
    mode,
    openDrawer,
    gameTree,
    gameTrees,
    gameIndex,
    treePosition,

    gameInfo,
    currentPlayer,
    attachedEngineSyncers,
    blackEngineSyncerId,
    whiteEngineSyncerId,

    scoringMethod,
    scoreBoard,
    areaMap,

    engines,
    graphGridSize,
    preferencesTab,
  }) {
    return h(
      'section',
      {},
      h(InfoDrawer, {
        show: openDrawer === 'info',
        gameTree,
        gameInfo,
        currentPlayer,
        attachedEngineSyncers,
        blackEngineSyncerId,
        whiteEngineSyncerId,
      }),

      h(PreferencesDrawer, {
        show: openDrawer === 'preferences',
        tab: preferencesTab,
        engines,
        graphGridSize,
      }),

      h(GameChooserDrawer, {
        show: openDrawer === 'gamechooser',
        gameTrees,
        gameIndex,
        gameDirectories: this.props.gameDirectories,
        gameTreeDirectories: this.props.gameTreeDirectories,

        onItemClick: this.handleGameSelect,
        onChange: this.handleGameTreesChange,
      }),

      h(CleanMarkupDrawer, {
        show: openDrawer === 'cleanmarkup',
        gameTree,
        treePosition,
      }),

      h(AdvancedPropertiesDrawer, {
        show: openDrawer === 'advancedproperties',
        gameTree,
        treePosition,
      }),

      h(ScoreDrawer, {
        show: openDrawer === 'score',
        estimating: mode === 'estimator',
        areaMap,
        board: scoreBoard,
        method: scoringMethod,
        komi: +getRootProperty(gameTree, 'KM', 0),
        handicap: +getRootProperty(gameTree, 'HA', 0),

        onSubmitButtonClick: this.handleScoreSubmit,
      }),
    )
  }
}
