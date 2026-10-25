using UnityEngine;
using UnityEngine.Events;

namespace MimiHorror.Interaction
{
    /// <summary>
    /// 「調べられるもの」に付けるコンポーネント。
    /// ドア・日本人形・手紙など、Collider があるオブジェクト（またはその親）に付ける。
    /// 実際の処理は Inspector の On Interact イベントに登録するだけでよい（コード不要）。
    /// </summary>
    public class Interactable : MonoBehaviour
    {
        [Tooltip("画面中央に表示する文言。例：調べる / 襖を開ける / 手紙を読む")]
        [SerializeField] private string prompt = "調べる";

        [Tooltip("ON にすると一度調べたら二度と反応しなくなる（手紙など）")]
        [SerializeField] private bool oneShot = false;

        [Header("調べたときに実行される処理をここに登録")]
        [SerializeField] private UnityEvent onInteract;

        private bool _hasUsed;

        public string Prompt => prompt;
        public bool CanInteract => !oneShot || !_hasUsed;

        public virtual void Interact(GameObject interactor)
        {
            if (!CanInteract)
            {
                return;
            }

            _hasUsed = true;
            Debug.Log($"[調べる] {gameObject.name} : {prompt}", this);
            onInteract?.Invoke();
        }

        /// <summary>フラグを戻したいとき（ギミックのリセットなど）</summary>
        public void ResetUsed()
        {
            _hasUsed = false;
        }
    }
}
