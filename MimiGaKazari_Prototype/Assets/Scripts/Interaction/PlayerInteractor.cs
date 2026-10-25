using System;
using UnityEngine;

namespace MimiHorror.Interaction
{
    /// <summary>
    /// 画面中央 Raycast による軽量な「調べる」判定。
    /// - Raycast は毎フレームではなく checkInterval 間隔（既定 0.08 秒）だけ実行
    /// - GetComponentInParent は「当たった Collider が変わったとき」だけ実行しキャッシュ
    /// - UI へは Action イベントで通知するので、TextMeshPro 等への依存なし
    /// </summary>
    public class PlayerInteractor : MonoBehaviour
    {
        [Header("参照")]
        [Tooltip("Ray の起点。通常は Main Camera")]
        [SerializeField] private Transform cameraTransform;

        [Header("判定")]
        [SerializeField] private float interactDistance = 2.6f;
        [Tooltip("調べられる物だけを Interactable レイヤーに入れるとさらに速くなる")]
        [SerializeField] private LayerMask interactMask = ~0;
        [SerializeField] private KeyCode interactKey = KeyCode.E;
        [Tooltip("Raycast を行う間隔（秒）。0 で毎フレーム")]
        [SerializeField] private float checkInterval = 0.08f;

        /// <summary>注目中の対象が変わったら呼ばれる。引数は表示文言（なければ空文字）</summary>
        public event Action<string> PromptChanged;

        public Interactable Current { get; private set; }
        public bool HasFocus => Current != null;

        private float _timer;
        private Collider _lastHitCollider;
        private Interactable _cachedInteractable;

        private void Awake()
        {
            if (cameraTransform == null && Camera.main != null)
            {
                cameraTransform = Camera.main.transform;
            }
        }

        private void Update()
        {
            _timer -= Time.deltaTime;
            if (_timer <= 0f)
            {
                _timer = checkInterval;
                RefreshFocus();
            }

            if (Current != null && Input.GetKeyDown(interactKey))
            {
                Current.Interact(gameObject);
                _timer = 0f; // oneShot 等の変化を次フレームですぐ反映する
            }
        }

        private void RefreshFocus()
        {
            if (cameraTransform == null)
            {
                SetCurrent(null);
                return;
            }

            Ray ray = new Ray(cameraTransform.position, cameraTransform.forward);

            if (!Physics.Raycast(ray, out RaycastHit hit, interactDistance, interactMask, QueryTriggerInteraction.Ignore))
            {
                _lastHitCollider = null;
                _cachedInteractable = null;
                SetCurrent(null);
                return;
            }

            // 同じ Collider に当たり続けている間は検索しない
            if (hit.collider != _lastHitCollider)
            {
                _lastHitCollider = hit.collider;
                _cachedInteractable = hit.collider.GetComponentInParent<Interactable>();
            }

            SetCurrent(_cachedInteractable != null && _cachedInteractable.CanInteract
                ? _cachedInteractable
                : null);
        }

        private void SetCurrent(Interactable next)
        {
            if (Current == next)
            {
                return;
            }

            Current = next;
            PromptChanged?.Invoke(next != null ? next.Prompt : string.Empty);
        }

        private void OnDisable()
        {
            SetCurrent(null);
        }
    }
}
